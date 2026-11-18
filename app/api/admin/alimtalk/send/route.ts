import { NextRequest, NextResponse } from "next/server";
import {
  AligoTemplateCode,
  buildOrderAlimtalkVariables,
  normalizePhone,
  sendAligoAlimtalk,
} from "@/lib/backend-core";
import { calculateRefiningEstimate, TrackType } from "@/lib/refining-calc";

const CF_WORKER_ORIGIN = "https://ionlab-refinery.wonhongsik.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      adminPin?: string;
      receiptNumber?: string;
      tplCode?: AligoTemplateCode;
      customComment?: string;
    };

    const res = await fetch(`${CF_WORKER_ORIGIN}/api/admin/alimtalk/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      result?: { code?: number; message?: string; tplCode?: string };
    };

    const isIpAuthError =
      !data?.ok &&
      Number(data?.result?.code) === -99 &&
      String(data?.result?.message || "")
        .toUpperCase()
        .includes("IP");

    if (!isIpAuthError) {
      return NextResponse.json(data, { status: res.status });
    }

    // Vultr 프록시 IP 심사 중 Worker에서 IP 미인증(-99)이 반환되면,
    // 로컬 Next.js 서버(집 IP)에서 주문 정보를 조회한 뒤 알리고 직통 엔드포인트로 발송합니다.
    const adminPin = (body.adminPin || "").trim();
    const receiptNumber = (body.receiptNumber || "").trim();
    const tplCode = (body.tplCode || "UN_8291") as AligoTemplateCode;

    if (!receiptNumber) {
      return NextResponse.json(data, { status: res.status });
    }

    const ordersRes = await fetch(`${CF_WORKER_ORIGIN}/api/admin/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminPin }),
    });
    if (!ordersRes.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    const ordersData = (await ordersRes.json()) as {
      ok?: boolean;
      orders?: Array<Record<string, unknown>>;
      logsByReceipt?: Record<string, Array<Record<string, unknown>>>;
    };

    const orders = ordersData.orders || [];
    const orderRow = orders.find(
      (o) => String(o.receipt_number || "") === receiptNumber
    );
    if (!orderRow) {
      return NextResponse.json(
        { ok: false, error: "해당 주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const cEmail = String(orderRow.client_email || "")
      .trim()
      .toLowerCase();
    const cPhoneNorm = normalizePhone(String(orderRow.client_phone || ""));
    const confirmedCumGold = Number(
      orders
        .filter(
          (r) =>
            String(r.client_email || "")
              .trim()
              .toLowerCase() === cEmail &&
            normalizePhone(String(r.client_phone || "")) === cPhoneNorm
        )
        .reduce((acc, r) => acc + Number(r.actual_gold || 0), 0)
        .toFixed(2)
    );

    const trackTypeVal: TrackType =
      String(orderRow.track) === "ic" ? "ic" : "plating";
    const needsPreVal =
      String(orderRow.preprocess_option || "none") !== "none";
    const actWGrams = Math.round(
      Number(orderRow.actual_weight ?? orderRow.weight ?? 1) * 1000
    );
    const recalcEst = calculateRefiningEstimate(
      trackTypeVal,
      Math.max(1000, actWGrams),
      needsPreVal,
      Number(orderRow.expected_gold || 5),
      Number(orderRow.gold_price || 171020)
    );

    const orderLogs = ordersData.logsByReceipt?.[receiptNumber] || [];
    const latestLogRow =
      orderLogs.length > 0 ? orderLogs[orderLogs.length - 1] : undefined;

    const vars = buildOrderAlimtalkVariables(orderRow, {
      tplCode,
      measuredValue: latestLogRow?.measured_value
        ? String(latestLogRow.measured_value)
        : null,
      logDetail:
        body.customComment ||
        (latestLogRow?.log_detail ? String(latestLogRow.log_detail) : null),
      confirmedCumulativeGold: confirmedCumGold,
      recalculatedWorkFee: recalcEst.finalWorkFee,
      workFeeDiffAmount:
        recalcEst.finalWorkFee - Number(orderRow.final_work_fee || 0),
    });

    const targetPhone =
      tplCode === "UN_8301"
        ? process.env.ALIGO_SENDER_PHONE || "01057980188"
        : String(orderRow.client_phone || "");
    const targetName =
      tplCode === "UN_8301"
        ? "원홍식 대표"
        : String(orderRow.client_name || "고객");

    const localSendRes = await sendAligoAlimtalk({
      tplCode,
      receiverPhone: targetPhone,
      receiverName: targetName,
      variables: vars,
      config: { proxyUrl: "https://kakaoapi.aligo.in" },
    });

    return NextResponse.json(
      {
        ok: localSendRes.sent,
        result: localSendRes,
        fallbackMode: "LOCAL_HOME_IP",
      },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "ALIMTALK_SEND_PROXY_FAILED",
      },
      { status: 500 }
    );
  }
}
