"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Copy,
  Check,
  Download,
  FileText,
  Lock,
  ArrowRight,
} from "lucide-react";
import { OrderSubmissionPayload, formatKRW } from "@/lib/refining-calc";

interface ReceiptModalProps {
  receiptData: OrderSubmissionPayload;
  onClose: () => void;
  onOpenTracker: (email: string, phone: string, password: string) => void;
}

export default function ReceiptModal({
  receiptData,
  onClose,
  onOpenTracker,
}: ReceiptModalProps) {
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  const buildReceiptSummaryText = (data: OrderSubmissionPayload): string => {
    const settlementLabel =
      data.settlementType === "physical_gold"
        ? "순금 실물 (Gold Button) 수령"
        : "종로 당일 시세 현금 정산 (즉시 계좌 입금)";

    const settlementDetailLines =
      data.settlementType === "physical_gold"
        ? [
            `• 수령 방식: ${
              data.deliveryMethod === "visit"
                ? "평택 정련실 직접 방문 수령"
                : "우체국 안심소포(보험등기) 택배 수령"
            }`,
            data.deliveryMethod !== "visit"
              ? `• 배송 주소: [${data.zonecode || "-"}] ${
                  data.roadAddress || ""
                } ${data.detailAddress || ""}`
              : `• 방문처: 경기도 평택시 고덕면 도시지원1길 116, 208호`,
          ]
        : [
            `• 정산 입금계좌: ${data.bankName || "-"} ${
              data.bankAccount || "-"
            } (예금주: ${data.accountHolder || data.clientName})`,
            `• 명의 일치 확인: 의뢰인 성함과 입금계좌 예금주 일치 확인 완료`,
            `• 법인 출금 세법 구분: ${data.taxOptionLabel || "-"}`,
            `• 원천징수 공제 세액: ₩${formatKRW(
              data.withholdingTaxAmount || 0
            )}`,
            `• 세후 실입금 예정액: ₩${formatKRW(
              data.finalCashPayout ?? data.estimate.netClientProfit
            )}`,
          ];

    return [
      `=========================================`,
      `[이온랩 IONLAB REFINERY 위탁 추출 신청서]`,
      `=========================================`,
      `■ 접수번호: ${data.receiptNumber}`,
      `■ 접수일시: ${data.submittedAt}`,
      `■ 작업로그 조회 비밀번호: ${data.accessPassword || "이메일 발송됨"}`,
      `-----------------------------------------`,
      `[1. 의뢰인 및 정산/배송 정보]`,
      `• 성함/업체명: ${data.clientName}`,
      `• 연락처: ${data.clientPhone}`,
      `• 이메일: ${data.clientEmail}`,
      `• 정산 희망 방식: ${settlementLabel}`,
      ...settlementDetailLines,
      `• 첨부 사진(${data.photoNames.length}건): ${data.photoNames.join(", ")}`,
      `-----------------------------------------`,
      `[2. 작업 조건 및 예상 견적 요약]`,
      `• 선택 트랙: ${data.estimate.trackName}`,
      `• 의뢰 중량: ${data.weight.toFixed(2)} kg (${data.weightGrams.toLocaleString()}g · 단독 배치 정밀 정련)`,
      `• 전처리 옵션: ${data.estimate.preprocessLabel}`,
      `• 정련 순도 기준: ${data.estimate.purityLabel}`,
      `• 시뮬레이션 예상 수율: 약 ${data.expectedGold} g (KRX 기준 금 시세 ₩${formatKRW(
        data.goldPrice
      )}/g)`,
      `-----------------------------------------`,
      `[3. 예상 비용 및 수익 시뮬레이션]`,
      `• 기본 작업비(A): ₩${formatKRW(data.estimate.baseCostA)}`,
      `• 전처리 비용(B): ₩${formatKRW(data.estimate.preprocessCostB)}`,
      `• 고수율 연동 여부: ${
        data.estimate.isRatioApplied
          ? `고수율 비율제 적용 (${data.estimate.highYieldRatePercent}% + 약품실비 + 전처리)`
          : `표준 정액제 적용 (기본 작업비 + 선택 전처리)`
      }`,
      `▶ 최종 예상 청구 작업비: ₩${formatKRW(data.estimate.finalWorkFee)}`,
      `▶ 추출 금 예상 총 가치(V): ₩${formatKRW(
        data.estimate.totalGoldValueV
      )}`,
      `▶ 의뢰인 예상 순수익: ₩${formatKRW(data.estimate.netClientProfit)}`,
      `-----------------------------------------`,
      `[4. 특이사항 및 문의 메모]`,
      `${data.memo || "별도 기재사항 없음"}`,
      `-----------------------------------------`,
      `※ 입고처: 경기도 평택시 고덕면 도시지원1길 116, 208호 (평택 G1지식산업센터) (주)이온랩`,
      `※ 직통 문의: 010-5798-0188 | wonhongsik@gmail.com`,
      `=========================================`,
    ].join("\n");
  };

  const handleCopyReceiptToClipboard = async () => {
    const text = buildReceiptSummaryText(receiptData);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 3000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 3000);
    }
  };

  const handleDownloadTextReceipt = () => {
    const text = buildReceiptSummaryText(receiptData);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `이온랩_위탁추출신청서_${receiptData.receiptNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadImageReceipt = () => {
    const canvas = document.createElement("canvas");
    const width = 920;
    const height = 1160;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0B0F17");
    bgGrad.addColorStop(1, "#0F172A");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, width - 56, height - 56);

    ctx.fillStyle = "#FBBF24";
    ctx.font = "bold 28px Pretendard, sans-serif";
    ctx.fillText("IONLAB REFINERY | 온라인 위탁 정련 접수증", 64, 92);

    ctx.fillStyle = "#38BDF8";
    ctx.font = "600 15px Pretendard, sans-serif";
    ctx.fillText(
      `특허출원 제10-2026-0182129호 기반 소규모 정밀 습식 금 추출 센터`,
      64,
      122
    );

    ctx.fillStyle = "#94A3B8";
    ctx.font = "15px Pretendard, sans-serif";
    ctx.fillText(
      `접수번호: ${receiptData.receiptNumber}   |   비밀번호: ${
        receiptData.accessPassword || "-"
      }   |   일시: ${receiptData.submittedAt}`,
      64,
      152
    );

    let currentY = 205;
    const drawRow = (
      label: string,
      value: string,
      valueColor = "#F8FAFC",
      isBold = false
    ) => {
      ctx.fillStyle = "#94A3B8";
      ctx.font = "17px Pretendard, sans-serif";
      ctx.fillText(label, 64, currentY);

      ctx.fillStyle = valueColor;
      ctx.font = `${isBold ? "bold " : ""}18px Pretendard, sans-serif`;
      ctx.fillText(value, 310, currentY);
      currentY += 36;
    };

    ctx.fillStyle = "#34D399";
    ctx.font = "bold 19px Pretendard, sans-serif";
    ctx.fillText("01. 의뢰인 및 작업로그 인증 정보", 64, currentY);
    currentY += 34;

    drawRow("의뢰인 / 업체명", receiptData.clientName, "#FFFFFF", true);
    drawRow(
      "연락처 / 이메일",
      `${receiptData.clientPhone} (${receiptData.clientEmail})`,
      "#FFFFFF"
    );
    drawRow(
      "작업로그 조회 비밀번호",
      receiptData.accessPassword || "이메일 발송됨",
      "#38BDF8",
      true
    );
    drawRow(
      "희망 정산 방식",
      receiptData.settlementType === "physical_gold"
        ? "순금 실물 (Gold Button) 수령"
        : "종로 당일 시세 현금 정산 (즉시 입금)",
      "#FBBF24",
      true
    );

    currentY += 16;
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 19px Pretendard, sans-serif";
    ctx.fillText("02. 위탁 정련 공정 및 순도 옵션", 64, currentY);
    currentY += 34;

    drawRow("선택 공정 트랙", receiptData.estimate.trackName, "#38BDF8", true);
    drawRow(
      "의뢰 모재 중량",
      `${receiptData.weight} kg (단독 배치 정밀 정련)`,
      "#FFFFFF",
      true
    );
    drawRow("전처리 옵션", receiptData.estimate.preprocessLabel, "#E2E8F0");
    drawRow("목표 순도 옵션", receiptData.estimate.purityLabel, "#FBBF24", true);

    currentY += 16;
    ctx.fillStyle = "#FBBF24";
    ctx.font = "bold 19px Pretendard, sans-serif";
    ctx.fillText("03. 투명 공임 산출 및 예상 수익 시뮬레이션", 64, currentY);
    currentY += 34;

    drawRow(
      "기본 작업비(A) / 전처리(B)",
      `₩${formatKRW(receiptData.estimate.baseCostA)} / ₩${formatKRW(
        receiptData.estimate.preprocessCostB
      )}`
    );

    currentY += 10;
    ctx.fillStyle = "#1E293B";
    ctx.fillRect(64, currentY, width - 128, 125);
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(64, currentY, width - 128, 125);

    ctx.fillStyle = "#CBD5E1";
    ctx.font = "17px Pretendard, sans-serif";
    ctx.fillText("최종 청구 예정 작업비:", 92, currentY + 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px Pretendard, sans-serif";
    ctx.fillText(
      `₩ ${formatKRW(receiptData.estimate.finalWorkFee)}`,
      310,
      currentY + 40
    );

    ctx.fillStyle = "#CBD5E1";
    ctx.font = "17px Pretendard, sans-serif";
    ctx.fillText("추출 순금 예상 총 가치:", 92, currentY + 74);
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 20px Pretendard, sans-serif";
    ctx.fillText(
      `₩ ${formatKRW(receiptData.estimate.totalGoldValueV)}`,
      310,
      currentY + 74
    );

    ctx.fillStyle = "#FBBF24";
    ctx.font = "bold 19px Pretendard, sans-serif";
    ctx.fillText("의뢰인 예상 순수익:", 92, currentY + 108);
    ctx.fillStyle =
      receiptData.estimate.netClientProfit >= 0 ? "#FBBF24" : "#F87171";
    ctx.font = "bold 25px Pretendard, sans-serif";
    ctx.fillText(
      `₩ ${formatKRW(receiptData.estimate.netClientProfit)}`,
      310,
      currentY + 108
    );

    currentY += 165;
    ctx.fillStyle = "#64748B";
    ctx.font = "14px Pretendard, sans-serif";
    ctx.fillText(
      "주식회사 이온랩 (IONLAB Co., Ltd.) | 대표이사: 원홍식 | 사업자등록번호: 272-87-04029",
      64,
      currentY
    );
    ctx.fillText(
      "입고처: 경기도 평택시 고덕면 도시지원1길 116, 208호 (평택 G1지식산업센터) | 연락처: 010-5798-0188",
      64,
      currentY + 24
    );

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `이온랩_접수요약서_${receiptData.receiptNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-amber-500/50 bg-[#0F172A] p-6 shadow-[0_0_60px_rgba(245,158,11,0.25)] sm:p-8">
        {/* 모달 상단 헤더 */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-extrabold text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              온라인 위탁 추출 신청 & 이메일 발송 완료
            </div>
            <h3 className="mt-2 text-xl font-extrabold text-white sm:text-2xl">
              이온랩 위탁 정련 접수 영수증
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              접수번호:{" "}
              <strong className="text-amber-300">
                {receiptData.receiptNumber}
              </strong>{" "}
              | 일시: {receiptData.submittedAt}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 hover:border-slate-500 hover:text-white"
          >
            닫기 ✕
          </button>
        </div>

        {/* 발급된 작업 로그 조회용 비밀번호 안내 카드 */}
        <div className="mt-5 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-950/40 via-[#0B0F17] to-[#0B0F17] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-cyan-300">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>전용 작업 로그 조회 비밀번호 발급 완료 (이메일 발송됨)</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                입력하신 이메일(<strong>{receiptData.clientEmail}</strong>)로{" "}
                <strong className="text-emerald-300">
                  주식회사 이온랩 입금 전용 법인계좌 안내
                </strong>
                와 아래 조회 비밀번호가 발송되었습니다. (범죄 악용 방지를 위해
                웹사이트에는 당사 계좌번호를 표시하지 않습니다)
              </p>
            </div>
            <div className="rounded-xl border border-amber-400/60 bg-amber-500/20 px-4 py-2 text-center">
              <div className="text-[10px] font-bold text-amber-200">
                임시 비밀번호
              </div>
              <div className="font-mono text-lg font-black tracking-widest text-amber-300">
                {receiptData.accessPassword || "이메일확인"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenTracker(
                receiptData.clientEmail,
                receiptData.clientPhone,
                receiptData.accessPassword || ""
              )
            }
            className="mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-cyan-300 sm:text-sm"
          >
            <span>내 전용 실시간 작업 로그 화면 바로 열기</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* 요약 테이블 */}
        <div className="mt-4 space-y-4 text-sm">
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F17] p-4">
            <div className="text-xs font-bold text-amber-400">
              작업 조건 및 자동 산출 견적 요약표
            </div>
            <div className="mt-3 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">의뢰인 / 연락처</span>
                <span className="font-bold text-white">
                  {receiptData.clientName} ({receiptData.clientPhone})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">선택 트랙 / 중량</span>
                <span className="font-bold text-white">
                  {receiptData.estimate.trackName} · {receiptData.weight}kg
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">전처리 옵션</span>
                <span className="font-semibold text-slate-200">
                  {receiptData.estimate.preprocessLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">목표 순도 옵션</span>
                <span className="font-bold text-amber-300">
                  {receiptData.estimate.purityLabel}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="font-bold text-white">
                  최종 예상 청구 작업비
                </span>
                <span className="text-base font-extrabold text-amber-400">
                  ₩ {formatKRW(receiptData.estimate.finalWorkFee)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-white">
                  예상 추출 순금 총 가치 ({receiptData.expectedGold}g 기준)
                </span>
                <span className="font-bold text-cyan-300">
                  ₩ {formatKRW(receiptData.estimate.totalGoldValueV)}
                </span>
              </div>
              <div className="flex justify-between rounded-xl bg-amber-500/10 px-3 py-2">
                <span className="font-extrabold text-amber-300">
                  의뢰인 예상 순수익
                </span>
                <span className="text-base font-extrabold text-amber-400">
                  ₩ {formatKRW(receiptData.estimate.netClientProfit)}
                </span>
              </div>
              {receiptData.settlementType === "cash_transfer" ? (
                <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs">
                  <div className="font-bold text-emerald-300">
                    💳 현금 정산 계좌 및 법인 출금 세금공제 확인
                  </div>
                  <div className="mt-1 text-slate-300">
                    • 입금계좌: <strong>{receiptData.bankName}</strong>{" "}
                    {receiptData.bankAccount} (예금주:{" "}
                    {receiptData.accountHolder} · 본인 일치 확인됨)
                  </div>
                  <div className="mt-0.5 text-slate-300">
                    • 세법 적용: {receiptData.taxOptionLabel}
                  </div>
                  <div className="mt-0.5 font-bold text-emerald-300">
                    • 원천징수 세액: -₩
                    {formatKRW(receiptData.withholdingTaxAmount || 0)} ➔ 세후
                    실입금 예정액:{" "}
                    <span className="text-amber-300">
                      ₩
                      {formatKRW(
                        receiptData.finalCashPayout ??
                          receiptData.estimate.netClientProfit
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
                  <div className="font-bold text-amber-300">
                    📦 순금 실물 수령 방식 및 주소
                  </div>
                  <div className="mt-1 text-slate-300">
                    {receiptData.deliveryMethod === "visit"
                      ? "• 평택 정련실 직접 방문 수령"
                      : `• 우체국 안심소포 배송지: [${receiptData.zonecode}] ${receiptData.roadAddress} ${receiptData.detailAddress || ""}`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 모달 액션 버튼 그룹 */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleCopyReceiptToClipboard}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3.5 text-xs font-extrabold text-slate-950 shadow-lg transition hover:brightness-110 sm:text-sm"
          >
            {copiedReceipt ? (
              <>
                <Check className="h-4 w-4" />
                <span>클립보드 복사 완료!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>접수 내역 클립보드 복사</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadImageReceipt}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-3.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/25 sm:text-sm"
          >
            <Download className="h-4 w-4" />
            <span>신청 요약서 이미지 저장</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTextReceipt}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0B0F17] px-4 py-3.5 text-xs font-bold text-slate-200 transition hover:border-slate-500 sm:text-sm"
          >
            <FileText className="h-4 w-4 text-amber-400" />
            <span>신청 요약서 텍스트 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
}
