"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  Coins,
  Phone,
  Mail,
  KeyRound,
  ArrowLeft,
  Layers,
  Award,
  ExternalLink,
  X,
  Scale,
  Upload,
  Lock,
  Unlock,
  Video,
  Image as ImageIcon,
  Clock,
  Trash2,
  Copy,
  FileCheck2,
  Truck,
  CreditCard,
} from "lucide-react";
import {
  OrderRecord,
  OrderLogRecord,
  parseMediaUrls,
  deduplicateUrlArray,
  isVideoUrl,
} from "./ClientTrackerView";
import { formatKRW } from "@/lib/refining-calc";

interface EnrichedAdminOrder extends OrderRecord {
  access_password?: string;
  memo?: string;
  customerStats?: {
    orderCount: number;
    confirmedGoldGrams: number;
    totalGoldGrams: number;
    totalWeightKg: number;
  };
}

interface AdminDashboardViewProps {
  onClose?: () => void;
  isStandalonePage?: boolean;
}

const STEP_CONFIGS = [
  {
    step: 1,
    badge: "STEP 01 · 입금확인 & 모재 실측",
    title: "작업비 입금 확인 및 입고 모재 정밀 실측 계량 완료",
    defaultDetail:
      "기본 작업비 입금 확인 후, 평택 정련실에 입고된 모재를 영점 검교정된 전자저울로 실중량 계량 완료했습니다.",
    measuredHint: "예: 실측 입고 모재 1,960g (1.96kg) · 입금확인 완료",
  },
  {
    step: 2,
    badge: "STEP 02 · 습식 침출 & 환원",
    title: "단독 배치 선택적 용해 및 고순도 금 환원 침전 완료",
    defaultDetail:
      "의뢰인 단독 배치 반응조에서 베이스 메탈 분리 및 금 선택 침출 후, 고순도 환원제를 투입하여 골드 파우더 침전을 완료했습니다.",
    measuredHint: "예: 침출 반응 온도 65℃ · 여과 및 침전 상태 양호",
  },
  {
    step: 3,
    badge: "STEP 03 · 순금 비드 추출·계량",
    title: "고온 용융 순금 비드(Gold Button) 성형 및 최종 중량 계량 완료",
    defaultDetail:
      "정제된 금 침전물을 세척·건조 후 고온 도가니에서 용융하여 고순도 골드 비드(98.5~99.5%) 추출 및 0.01g 단위 확정 계량을 마쳤습니다.",
    measuredHint: "예: 최종 추출 순금 비드 12.45g (순도 98.5~99.5%)",
  },
  {
    step: 4,
    badge: "STEP 04 · 정산 & 출고 (1사이클 마감)",
    title: "최종 정산 및 출고 완료 (정련 1사이클 최종 마감)",
    defaultDetail:
      "의뢰인께서 선택하신 방식에 따라 최종 정산 및 출고(우체국 안심소포 발송 또는 계좌 입금) 처리가 모두 완료되어 본 의뢰 건이 최종 마감되었습니다.",
    measuredHint: "예: 우체국 안심소포 등기 발송 완료 / 현금 정산 송금 완료",
  },
];

export default function AdminDashboardView({
  onClose,
  isStandalonePage = false,
}: AdminDashboardViewProps) {
  const [adminPin, setAdminPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [orders, setOrders] = useState<EnrichedAdminOrder[]>([]);
  const [logsByReceipt, setLogsByReceipt] = useState<
    Record<string, OrderLogRecord[]>
  >({});
  const [selectedReceipt, setSelectedReceipt] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stepFilter, setStepFilter] = useState<number | "ALL">("ALL");

  // 단계별 입력 상태 (1사이클 4단계 구조)
  const [editStep, setEditStep] = useState<number>(1);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(true);
  const [actualWeightGrams, setActualWeightGrams] = useState<string>(""); // STEP 1: 실측 모재 중량(g)
  const [editActualGold, setEditActualGold] = useState<string>(""); // STEP 3: 확정 금 추출량(g)
  const [logTitle, setLogTitle] = useState<string>("");
  const [logDetail, setLogDetail] = useState<string>("");
  const [measuredValue, setMeasuredValue] = useState<string>("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [retainedMediaUrls, setRetainedMediaUrls] = useState<string[]>([]);
  const [deletingMediaUrl, setDeletingMediaUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string>("");
  const [forceUnlock, setForceUnlock] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  // 선택된 주문 및 단계가 바뀔 때 폼 기본값 동기화
  const syncFormForOrderAndStep = (
    ord: EnrichedAdminOrder,
    targetStep: number,
    logsMap: Record<string, OrderLogRecord[]>
  ) => {
    const clampedStep = Math.min(4, Math.max(1, targetStep));
    setEditStep(clampedStep);
    setPaymentConfirmed(
      Number(ord.payment_confirmed || 0) === 1 ||
        Number(ord.current_step || 0) >= 1
    );
    setActualWeightGrams(
      ord.actual_weight !== null && ord.actual_weight !== undefined
        ? String(Math.round(Number(ord.actual_weight) * 1000))
        : String(Math.round(Number(ord.weight || 1) * 1000))
    );
    setEditActualGold(
      ord.actual_gold !== null && ord.actual_gold !== undefined
        ? String(ord.actual_gold)
        : ""
    );

    const orderLogs = logsMap[ord.receipt_number] || [];
    const existingStepLog = orderLogs.find(
      (l) => Number(l.step_number) === clampedStep
    );
    const cfg =
      STEP_CONFIGS.find((c) => c.step === clampedStep) || STEP_CONFIGS[0];

    if (existingStepLog) {
      setLogTitle(existingStepLog.log_title);
      setLogDetail(existingStepLog.log_detail);
      setMeasuredValue(existingStepLog.measured_value || "");
      setRetainedMediaUrls(parseMediaUrls(existingStepLog.photo_url));
    } else {
      setLogTitle(cfg.title);
      setLogDetail(cfg.defaultDetail);
      setMeasuredValue("");
      setRetainedMediaUrls([]);
    }
    setTrackingNumber("");
    setMediaFiles([]);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const fetchAdminData = async (pinToUse: string, keepReceipt?: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPin: pinToUse }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || "관리자 인증에 실패했습니다.");
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("ionlab_admin_pin", pinToUse);
      }

      const list: EnrichedAdminOrder[] = data.orders || [];
      const lMap: Record<string, OrderLogRecord[]> = data.logsByReceipt || {};
      setOrders(list);
      setLogsByReceipt(lMap);

      const targetReceipt = keepReceipt || selectedReceipt;
      const targetOrd =
        list.find((o) => o.receipt_number === targetReceipt) || list[0];

      if (targetOrd) {
        setSelectedReceipt(targetOrd.receipt_number);
        const curStep = Number(targetOrd.current_step ?? 0);
        // 다음 진행할 단계(입금/계량 전이면 STEP 1, STEP 1 완료면 STEP 2, ..., STEP 4 완료면 STEP 4) 자동 선택
        const nextStep = curStep < 4 ? curStep + 1 : 4;
        syncFormForOrderAndStep(targetOrd, nextStep, lMap);
      }
    } catch {
      setAuthError("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPin = sessionStorage.getItem("ionlab_admin_pin");
      if (savedPin) {
        setAdminPin(savedPin);
        fetchAdminData(savedPin);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.receipt_number === selectedReceipt) || null,
    [orders, selectedReceipt]
  );

  const sameCustomerOrders = useMemo(() => {
    if (!selectedOrder) return [];
    const targetEmail = (selectedOrder.client_email || "").toLowerCase();
    const targetPhone = (selectedOrder.client_phone || "").replace(/\D/g, "");
    return orders.filter(
      (o) =>
        (o.client_email || "").toLowerCase() === targetEmail &&
        (o.client_phone || "").replace(/\D/g, "") === targetPhone
    );
  }, [orders, selectedOrder]);

  const handleSelectOrder = (ord: EnrichedAdminOrder) => {
    setSelectedReceipt(ord.receipt_number);
    setForceUnlock(false);
    setSaveFeedback(null);
    const curStep = Number(ord.current_step ?? 0);
    const nextStep = curStep < 4 ? curStep + 1 : 4;
    syncFormForOrderAndStep(ord, nextStep, logsByReceipt);
  };

  const handleStepTabClick = (stepNum: number) => {
    if (!selectedOrder) return;
    setSaveFeedback(null);
    syncFormForOrderAndStep(selectedOrder, stepNum, logsByReceipt);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const curStep = Number(ord.current_step ?? 0);
      if (stepFilter !== "ALL" && curStep !== stepFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        (ord.client_name || "").toLowerCase().includes(q) ||
        (ord.client_phone || "").toLowerCase().includes(q) ||
        (ord.client_email || "").toLowerCase().includes(q) ||
        (ord.receipt_number || "").toLowerCase().includes(q)
      );
    });
  }, [orders, stepFilter, searchQuery]);

  const kpi = useMemo(() => {
    const totalCount = orders.length;
    const activeCount = orders.filter(
      (o) => Number(o.current_step ?? 0) < 4
    ).length;
    const confirmedGold = orders.reduce(
      (s, o) => s + Number(o.actual_gold ?? 0),
      0
    );
    const totalGold = orders.reduce(
      (s, o) => s + Number(o.actual_gold ?? o.expected_gold ?? 0),
      0
    );
    return {
      totalCount,
      activeCount,
      confirmedGold: confirmedGold.toFixed(2),
      totalGold: totalGold.toFixed(2),
    };
  }, [orders]);

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, 3);
    setMediaFiles(selected);
  };

  const handleSaveStepUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    // STEP 1에서는 실측 모재 중량 필수 검증
    if (
      editStep === 1 &&
      (!actualWeightGrams.trim() || Number(actualWeightGrams) <= 0)
    ) {
      setSaveFeedback({
        type: "err",
        msg: "⚠️ STEP 01 완료를 위해 실제 측정한 모재 중량(g)을 입력해 주세요.",
      });
      return;
    }

    // STEP 3에서는 실제 추출 금 중량 필수 검증
    if (
      editStep === 3 &&
      (!editActualGold.trim() || Number(editActualGold) < 0)
    ) {
      setSaveFeedback({
        type: "err",
        msg: "⚠️ STEP 03 완료를 위해 실제 추출된 순금 비드 중량(g)을 입력해 주세요.",
      });
      return;
    }

    setSaving(true);
    setSaveFeedback(null);

    try {
      const formData = new FormData();
      formData.append("adminPin", adminPin);
      formData.append("receiptNumber", selectedOrder.receipt_number);
      formData.append("stepNumber", String(editStep));
      formData.append("logTitle", logTitle.trim());
      formData.append("logDetail", logDetail.trim());
      formData.append("measuredValue", measuredValue.trim());
      formData.append("forceUnlock", String(forceUnlock));
      formData.append("paymentConfirmed", String(paymentConfirmed));
      formData.append(
        "retainedMediaUrlsJson",
        JSON.stringify(retainedMediaUrls)
      );

      if (actualWeightGrams.trim() !== "") {
        const weightKg = Number((Number(actualWeightGrams) / 1000).toFixed(3));
        formData.append("actualWeightKg", String(weightKg));
      }
      if (editActualGold.trim() !== "") {
        formData.append("actualGold", String(Number(editActualGold)));
      }

      mediaFiles.forEach((file) => {
        formData.append("mediaFiles", file);
      });

      const res = await fetch("/api/admin/update-order", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveFeedback({
          type: "err",
          msg: data.error || "저장에 실패했습니다.",
        });
        return;
      }

      setMediaFiles([]);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
      setForceUnlock(false);

      setSaveFeedback({
        type: "ok",
        msg:
          editStep === 4
            ? "🎉 STEP 04 최종 정산 및 출고가 완료되어 본 의뢰 건의 1사이클이 최종 마감(잠금)되었습니다!"
            : `✓ STEP 0${editStep} 공정 기록 및 Cloudflare R2 미디어가 정상 저장되었습니다!`,
      });

      await fetchAdminData(adminPin, selectedOrder.receipt_number);
    } catch {
      setSaveFeedback({
        type: "err",
        msg: "네트워크 통신 오류가 발생했습니다.",
      });
    } finally {
      setSaving(false);
    }
  };

  // 잘못 업로드한 단계별 사진/영상 개별 즉시 삭제 (R2 스토리지 + D1 로그 동시 제거)
  const handleDeleteSingleMedia = async (
    stepNum: number,
    mediaUrlToDelete: string
  ) => {
    if (!selectedOrder) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `STEP 0${stepNum}에 업로드된 이 사진/영상을 삭제하시겠습니까?\n(Cloudflare R2 및 고객 타임라인에서 즉시 제거됩니다)`
      )
    ) {
      return;
    }

    setDeletingMediaUrl(mediaUrlToDelete);
    setSaveFeedback(null);
    try {
      const res = await fetch("/api/admin/update-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPin,
          receiptNumber: selectedOrder.receipt_number,
          stepNumber: stepNum,
          deleteMediaUrl: mediaUrlToDelete,
          forceUnlock: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSaveFeedback({
          type: "err",
          msg: data.error || "미디어 삭제에 실패했습니다.",
        });
        return;
      }

      if (stepNum === editStep) {
        setRetainedMediaUrls((prev) =>
          prev.filter((u) => u !== mediaUrlToDelete)
        );
      }

      setSaveFeedback({
        type: "ok",
        msg: `🗑️ STEP 0${stepNum}에서 선택한 사진/영상이 정상 삭제되었습니다.`,
      });
      await fetchAdminData(adminPin, selectedOrder.receipt_number);
    } catch {
      setSaveFeedback({
        type: "err",
        msg: "미디어 삭제 중 통신 오류가 발생했습니다.",
      });
    } finally {
      setDeletingMediaUrl(null);
    }
  };

  const activeLogs: OrderLogRecord[] = selectedOrder
    ? logsByReceipt[selectedOrder.receipt_number] || []
    : [];

  const parsedClientPhotos: string[] = (() => {
    if (!selectedOrder?.photo_urls_json) return [];
    try {
      const arr = JSON.parse(selectedOrder.photo_urls_json);
      return Array.isArray(arr) ? deduplicateUrlArray(arr) : [];
    } catch {
      return [];
    }
  })();

  const isOrderCycleLocked = Boolean(
    selectedOrder &&
      (Number(selectedOrder.is_cycle_locked || 0) === 1 ||
        Number(selectedOrder.current_step || 0) >= 4 ||
        selectedOrder.status === "COMPLETED")
  );

  const requestedGrams = selectedOrder
    ? Math.round(Number(selectedOrder.weight || 0) * 1000)
    : 0;
  const measuredGramsNum = Number(actualWeightGrams || 0);
  const weightDiffGrams = measuredGramsNum - requestedGrams;

  // STEP 04 정산·출고 단계용 확정/예상 순금 기반 실시간 정산액 계산
  // ※ 작업비는 STEP 01에서 이미 선입금 받았으므로, 현금 정산 송금액 산정 시 이중 차감하지 않고
  //    소비자 매도(팔 때) 시세인 [정련소 매입가(KRX 기준가의 97.5%)]를 적용하여 매입대금을 송금합니다.
  const REFINERY_BUY_RATE = 0.975;
  const isGoldConfirmed = Boolean(
    selectedOrder &&
      ((selectedOrder.actual_gold !== null &&
        selectedOrder.actual_gold !== undefined &&
        Number(selectedOrder.actual_gold) > 0) ||
        (editActualGold.trim() !== "" && Number(editActualGold) > 0))
  );
  const settlementGoldGrams = selectedOrder
    ? selectedOrder.actual_gold !== null &&
      selectedOrder.actual_gold !== undefined
      ? Number(selectedOrder.actual_gold)
      : editActualGold.trim() !== ""
        ? Number(editActualGold)
        : Number(selectedOrder.expected_gold || 0)
    : 0;
  const settlementGoldPrice = Number(selectedOrder?.gold_price || 180000);
  const settlementBuyPrice = Math.round(settlementGoldPrice * REFINERY_BUY_RATE); // 정련소 실물 순금비드 매입가 (97.5%)
  const settlementGrossValue = Math.round(
    settlementGoldGrams * settlementGoldPrice
  ); // KRX 100% 기준 금 가치
  const settlementCashGross = Math.round(
    settlementGoldGrams * settlementBuyPrice
  ); // 정련소 매입가 기준 세전 매입 평가액
  const settlementWorkFee = Number(selectedOrder?.final_work_fee || 0);

  const isWithholding33Order =
    selectedOrder?.tax_option === "personal_withholding_33" ||
    (!selectedOrder?.tax_option &&
      selectedOrder?.settlement_type === "cash_transfer");

  // 현금 정산 시 회사가 고객에게 송금하는 금액 산정 (선입금 작업비 이중차감 배제)
  const settlementWithholdingTax = isWithholding33Order
    ? Math.floor((settlementCashGross * 0.033) / 10) * 10
    : 0;
  const settlementFinalCashPayout = Math.max(
    0,
    settlementCashGross - settlementWithholdingTax
  );
  // (참고) 고객의 최종 투자 순수익 = 세후 실송금액 - 선입금 작업비
  const settlementNetClientProfit = settlementFinalCashPayout - settlementWorkFee;

  return (
    <div
      className={
        isStandalonePage
          ? "min-h-screen bg-[#070A10] text-slate-100"
          : "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/90 backdrop-blur-xl sm:p-4"
      }
    >
      <div
        className={
          isStandalonePage
            ? "mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
            : "relative flex h-full max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-[#070A10] shadow-2xl"
        }
      >
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/90 bg-[#0B0F17]/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold tracking-wider text-amber-400 uppercase">
                  IONLAB ADMIN CONSOLE
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                  1사이클 4단계 · R2 영상/사진 저장
                </span>
              </div>
              <h1 className="text-base font-extrabold text-white sm:text-lg">
                의뢰인 주문 목록 · 실측 모재 계량 · 단계별 R2 영상/사진 관리
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => fetchAdminData(adminPin, selectedReceipt)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 hover:border-amber-400 hover:text-amber-300"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
                <span>새로고침</span>
              </button>
            )}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white"
              >
                <X className="h-4 w-4" />
                <span>닫기</span>
              </button>
            ) : (
              <a
                href="/"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>메인 페이지로</span>
              </a>
            )}
          </div>
        </div>

        {/* 미인증 시 PIN 로그인 화면 */}
        {!isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchAdminData(adminPin);
              }}
              className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl sm:p-8"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <KeyRound className="h-6 w-6" />
              </div>
              <h2 className="text-center text-lg font-extrabold text-white">
                이온랩 정련팀 관리자 로그인
              </h2>
              <p className="mt-1 text-center text-xs text-slate-400">
                보안 관리자 PIN 번호를 입력하면 전체 의뢰인 주문 목록과 단계별
                실측 계량·R2 사진/영상을 관리할 수 있습니다.
              </p>

              <div className="mt-5">
                <input
                  type="password"
                  required
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="관리자 PIN 입력"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center font-mono text-base font-bold tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {authError && (
                <p className="mt-2.5 text-center text-xs font-semibold text-rose-400">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
              >
                {loading ? "인증 및 데이터 불러오는 중..." : "관리자 콘솔 접속하기"}
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto p-4 sm:p-6">
            {/* 상단 KPI 카드 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <span className="text-xs text-slate-400">전체 누적 접수</span>
                <div className="mt-1 text-2xl font-black text-white">
                  {kpi.totalCount}건
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                <span className="text-xs text-cyan-300">현재 진행 중 의뢰</span>
                <div className="mt-1 text-2xl font-black text-cyan-300">
                  {kpi.activeCount}건
                </div>
              </div>
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                <span className="text-xs font-bold text-amber-300">
                  누적 확정 금 추출량
                </span>
                <div className="mt-1 text-2xl font-black text-amber-400">
                  {kpi.confirmedGold} g
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                <span className="text-xs text-emerald-300">
                  총 누적 금 물량 (예상포함)
                </span>
                <div className="mt-1 text-2xl font-black text-emerald-300">
                  {kpi.totalGold} g
                </div>
              </div>
            </div>

            {/* 메인 2단 레이아웃 */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* 좌측: 의뢰인 주문 목록 (5칼럼) */}
              <div className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-5">
                <div className="flex flex-col gap-2.5 border-b border-slate-800 pb-3.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="고객명, 전화번호, 이메일, 접수번호 검색..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pr-3 pl-10 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(["ALL", 0, 1, 2, 3, 4] as const).map((st) => (
                      <button
                        key={String(st)}
                        type="button"
                        onClick={() => setStepFilter(st)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                          stepFilter === st
                            ? "bg-amber-400 text-slate-950"
                            : "bg-slate-950 text-slate-400 hover:text-white"
                        }`}
                      >
                        {st === "ALL"
                          ? "전체"
                          : st === 0
                            ? "입고대기(0)"
                            : `STEP 0${st}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 주문 카드 리스트 */}
                <div className="mt-3 max-h-[680px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredOrders.map((ord) => {
                    const isSelected =
                      ord.receipt_number === selectedOrder?.receipt_number;
                    const curStep = Number(ord.current_step ?? 0);
                    const cStats = ord.customerStats || {
                      orderCount: 1,
                      confirmedGoldGrams: 0,
                      totalGoldGrams: ord.expected_gold,
                      totalWeightKg: ord.weight,
                    };
                    return (
                      <button
                        key={ord.receipt_number}
                        type="button"
                        onClick={() => handleSelectOrder(ord)}
                        className={`w-full rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? "border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/10"
                            : "border-slate-800/90 bg-slate-950/70 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-extrabold text-amber-300">
                            {ord.receipt_number}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              curStep >= 4
                                ? "bg-emerald-500/20 text-emerald-300"
                                : curStep === 0
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {curStep >= 4
                              ? "🔒 1사이클 마감(STEP 4)"
                              : curStep === 0
                                ? "입금·입고 대기"
                                : `STEP 0${curStep} 완료`}
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-sm font-extrabold text-white">
                            {ord.client_name}
                          </span>
                          <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300">
                            PW: {ord.access_password || "-"}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {ord.client_phone} · {ord.client_email}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2 text-[11px]">
                          <span className="font-semibold text-slate-200">
                            신청 {Number(ord.weight).toFixed(2)}kg
                            {ord.actual_weight !== null &&
                            ord.actual_weight !== undefined
                              ? ` → 실측 ${Number(ord.actual_weight).toFixed(
                                  2
                                )}kg`
                              : " (실측전)"}
                          </span>
                          <span className="font-bold text-amber-300">
                            {ord.actual_gold !== null &&
                            ord.actual_gold !== undefined
                              ? `확정 금 ${ord.actual_gold}g`
                              : `예상 금 ${ord.expected_gold}g`}
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-[11px]">
                          <span className="font-semibold text-cyan-300">
                            누적 의뢰 {cStats.orderCount}회
                          </span>
                          <span className="font-bold text-emerald-300">
                            누적 금: {cStats.totalGoldGrams}g (확정{" "}
                            {cStats.confirmedGoldGrams}g)
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredOrders.length === 0 && (
                    <div className="py-12 text-center text-xs text-slate-500">
                      조건에 해당하는 주문 내역이 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 우측: 선택된 주문 1사이클 4단계 관리 패널 (7칼럼) */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-7">
                {selectedOrder ? (
                  <div className="space-y-6">
                    {/* 1) 선택 주문 & 고객 누적 요약 헤더 */}
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-extrabold text-amber-300">
                            {selectedOrder.receipt_number}
                          </span>
                          <span className="text-xs text-slate-400">
                            접수: {selectedOrder.submitted_at}
                          </span>
                          {isOrderCycleLocked && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                              <Lock className="h-3 w-3" />
                              1사이클 정련 최종 마감됨
                            </span>
                          )}
                        </div>
                        <h2 className="mt-1.5 text-lg font-extrabold text-white sm:text-xl">
                          {selectedOrder.client_name} 고객님 (
                          {selectedOrder.track_name})
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {selectedOrder.client_phone}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {selectedOrder.client_email}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold text-amber-300">
                            PW: {selectedOrder.access_password}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`/?view=tracker&email=${encodeURIComponent(
                          selectedOrder.client_email
                        )}&phone=${encodeURIComponent(
                          selectedOrder.client_phone
                        )}&pw=${encodeURIComponent(
                          selectedOrder.access_password || ""
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
                      >
                        <span>의뢰인 화면 열기</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    {/* 이 고객의 누적 의뢰 이력 */}
                    <div className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <Award className="h-4 w-4 text-amber-400" />
                          <span>
                            고객 누적 의뢰 {sameCustomerOrders.length}회 · 신청{" "}
                            {Number(selectedOrder.weight).toFixed(2)}kg /{" "}
                            {selectedOrder.actual_weight !== null &&
                            selectedOrder.actual_weight !== undefined
                              ? `실측 ${Number(
                                  selectedOrder.actual_weight
                                ).toFixed(3)}kg`
                              : "실측 대기"}
                          </span>
                        </div>
                        <span className="text-xs font-extrabold text-emerald-400">
                          고객 누적 금 추출량:{" "}
                          {selectedOrder.customerStats?.totalGoldGrams ??
                            selectedOrder.expected_gold}
                          g (확정{" "}
                          {selectedOrder.customerStats?.confirmedGoldGrams ?? 0}
                          g)
                        </span>
                      </div>

                      {sameCustomerOrders.length > 1 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {sameCustomerOrders.map((co) => (
                            <button
                              key={co.receipt_number}
                              type="button"
                              onClick={() => handleSelectOrder(co)}
                              className={`rounded-xl border px-3 py-1.5 text-left text-xs transition ${
                                co.receipt_number ===
                                selectedOrder.receipt_number
                                  ? "border-amber-400 bg-amber-500/20 text-white"
                                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                              }`}
                            >
                              <div className="font-mono font-bold text-amber-300">
                                {co.receipt_number}
                              </div>
                              <div>
                                {co.actual_weight !== null &&
                                co.actual_weight !== undefined
                                  ? `실측 ${Number(co.actual_weight).toFixed(
                                      2
                                    )}kg`
                                  : `신청 ${Number(co.weight).toFixed(2)}kg`}{" "}
                                ·{" "}
                                {co.actual_gold !== null
                                  ? `확정 ${co.actual_gold}g`
                                  : `예상 ${co.expected_gold}g`}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 정산 계좌 · 세법 원천징수 확인 / 택배 배송지 정보 패널 */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 text-xs">
                      {selectedOrder.settlement_type === "cash_transfer" ? (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-extrabold text-emerald-300">
                              💳 [현금 정산 요청 건] 입금 계좌 · 예금주 본인 일치 · 법인 세법 공제 확인
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                !selectedOrder.account_holder ||
                                selectedOrder.account_holder.trim() ===
                                  selectedOrder.client_name.trim()
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {!selectedOrder.account_holder ||
                              selectedOrder.account_holder.trim() ===
                                selectedOrder.client_name.trim()
                                ? "✓ 의뢰인 = 예금주 명의 일치"
                                : `⚠️ 명의 대조 필요 (의뢰인: ${selectedOrder.client_name} / 예금주: ${selectedOrder.account_holder})`}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                              <span className="text-[11px] text-slate-400">
                                입금 은행 및 계좌번호
                              </span>
                              <p className="mt-0.5 font-mono font-bold text-white">
                                {selectedOrder.bank_name || "-"}{" "}
                                {selectedOrder.bank_account || "미입력"}
                              </p>
                              <p className="text-[11px] text-emerald-300">
                                예금주:{" "}
                                {selectedOrder.account_holder ||
                                  selectedOrder.client_name}
                              </p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
                              <span className="text-[11px] text-slate-400">
                                고객 동의 세법 공제 · 세무사 신고 증빙
                              </span>
                              <p className="mt-0.5 font-semibold text-amber-300">
                                {selectedOrder.tax_option_label ||
                                  "3.3% 원천징수 또는 지출증빙"}
                              </p>
                              {selectedOrder.business_number && (
                                <p className="font-mono text-[11px] text-cyan-300">
                                  사업자번호: {selectedOrder.business_number}
                                </p>
                              )}
                              {selectedOrder.resident_birth_prefix && (
                                <p className="font-mono text-[11px] text-cyan-300">
                                  생년월일(6자리):{" "}
                                  {selectedOrder.resident_birth_prefix}
                                </p>
                              )}
                              {selectedOrder.id_card_url ? (
                                <a
                                  href={`${selectedOrder.id_card_url}${
                                    selectedOrder.id_card_url.includes("?")
                                      ? "&"
                                      : "?"
                                  }adminPin=${encodeURIComponent(adminPin)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/30"
                                >
                                  <FileCheck2 className="h-3 w-3" />
                                  <span>신분증 사본 열람 (R2 보안인증)</span>
                                </a>
                              ) : (
                                selectedOrder.tax_option !==
                                  "business_invoice" && (
                                  <p className="mt-0.5 text-[10px] text-slate-400">
                                    신분증 사본:{" "}
                                    {selectedOrder.id_card_method ===
                                    "send_before_payout"
                                      ? "정산 송금 전 별도 제출 예정"
                                      : "미첨부"}
                                  </p>
                                )
                              )}
                            </div>
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                              <span className="text-[11px] text-emerald-300">
                                {isGoldConfirmed
                                  ? "원천징수 공제액 / 세후 확정 실송금액"
                                  : "예상 원천징수 공제 / 세후 예상 실송금액"}
                              </span>
                              <p className="mt-0.5 font-mono text-[11px] text-amber-300">
                                {isGoldConfirmed
                                  ? "확정 공제세액: -₩"
                                  : "예상 공제세액: -₩"}
                                {formatKRW(
                                  isGoldConfirmed
                                    ? settlementWithholdingTax
                                    : Number(
                                        selectedOrder.withholding_tax_amount || 0
                                      )
                                )}
                              </p>
                              <p className="font-mono text-sm font-black text-emerald-400">
                                {isGoldConfirmed
                                  ? "확정 실송금: ₩"
                                  : "예상 실송금: ₩"}
                                {formatKRW(
                                  isGoldConfirmed
                                    ? settlementFinalCashPayout
                                    : Number(
                                        selectedOrder.final_cash_payout ||
                                          selectedOrder.net_client_profit
                                      )
                                )}
                              </p>
                              {!isGoldConfirmed && (
                                <p className="mt-1 text-[10px] text-amber-200/90 font-sans">
                                  ※ 추출 전 접수시점 예상치 (STEP 03 실측 시 당일 시세로 최종 확정)
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-extrabold text-amber-300">
                              📦 [순금 실물(Gold Button) 수령 요청 건] 배송지 및 수령 방식
                            </span>
                            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                              {selectedOrder.delivery_method === "visit"
                                ? "평택 정련실 방문 수령"
                                : "우체국 안심소포(보험등기) 택배 발송"}
                            </span>
                          </div>
                          {selectedOrder.delivery_method === "visit" ? (
                            <p className="text-slate-300">
                              • 고객 직접 방문 수령 희망 (신분증 확인 후 순금 비드 인계)
                            </p>
                          ) : (
                            <p className="text-slate-200">
                              • <strong>카카오 우편번호 주소:</strong> [
                              {selectedOrder.zonecode || "-"}]{" "}
                              {selectedOrder.road_address || "주소 미기재"}{" "}
                              <strong className="text-amber-300">
                                {selectedOrder.detail_address || ""}
                              </strong>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2) 1사이클 마감 잠금 안내 배너 (STEP 4 완료 건) */}
                    {isOrderCycleLocked && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-4">
                        <div className="flex items-center gap-2.5 text-xs text-emerald-200">
                          <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
                          <span>
                            <strong>1사이클 공정 마감 완료:</strong> STEP 04(최종
                            정산 및 출고)까지 모두 끝난 의뢰 건이므로 불필요한
                            로그 누적이나 단계 되돌림이 잠금 처리되었습니다.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForceUnlock((prev) => !prev)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                            forceUnlock
                              ? "border-amber-400 bg-amber-500/20 text-amber-300"
                              : "border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
                          }`}
                        >
                          {forceUnlock ? (
                            <>
                              <Unlock className="h-3.5 w-3.5 text-amber-400" />
                              <span>예외 수정 활성화됨</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              <span>마감 잠금 해제 (특수 수정)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* 3) 4단계(STEP 1 ~ STEP 4) 선택 탭 & 단계별 맞춤 입력 폼 */}
                    <form
                      onSubmit={handleSaveStepUpdate}
                      className={`rounded-2xl border p-4 transition sm:p-5 ${
                        isOrderCycleLocked && !forceUnlock
                          ? "pointer-events-none border-slate-800 bg-slate-950/40 opacity-50"
                          : "border-amber-500/40 bg-slate-950/90"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-amber-300">
                          📌 작업할 공정 단계를 선택하세요 (단계당 1개의 공식
                          기록으로 저장·수정됩니다)
                        </span>
                      </div>

                      {/* STEP 1 ~ 4 탭 버튼 */}
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {STEP_CONFIGS.map((cfg) => {
                          const hasRecord = activeLogs.some(
                            (l) => Number(l.step_number) === cfg.step
                          );
                          const isCurrentTab = editStep === cfg.step;
                          return (
                            <button
                              key={cfg.step}
                              type="button"
                              onClick={() => handleStepTabClick(cfg.step)}
                              className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                                isCurrentTab
                                  ? "border-amber-400 bg-amber-500/20 text-white shadow-md"
                                  : hasRecord
                                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-200 hover:border-emerald-400"
                                    : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black">
                                  STEP 0{cfg.step}
                                </span>
                                {hasRecord ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Clock className="h-3.5 w-3.5 text-slate-600" />
                                )}
                              </div>
                              <div className="mt-1 text-[11px] font-bold leading-tight">
                                {cfg.step === 1
                                  ? "입금확인 & 모재계량"
                                  : cfg.step === 2
                                    ? "습식 침출·환원"
                                    : cfg.step === 3
                                      ? "순금 비드 추출·계량"
                                      : "정산·출고 (마감)"}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* =====================================================
                          [STEP 01 전용 필수 입력 박스]: 입금 확인 + 실측 모재 중량(g)
                      ===================================================== */}
                      {editStep === 1 && (
                        <div className="mt-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-300">
                            <Scale className="h-4 w-4 text-cyan-400" />
                            <span>
                              [STEP 01 필수 검수] 1) 작업비 입금 확인 + 2) 실제
                              입고된 모재 측정 중량(g) 입력
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* 입금 확인 체크 */}
                            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/90 p-3.5">
                              <input
                                type="checkbox"
                                checked={paymentConfirmed}
                                onChange={(e) =>
                                  setPaymentConfirmed(e.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                              />
                              <div>
                                <div className="text-xs font-extrabold text-white">
                                  기본 작업비 입금 확인 완료
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  청구 예정액: ₩
                                  { selectedOrder.final_work_fee.toLocaleString() }
                                </div>
                              </div>
                            </label>

                            {/* 실측 입고 모재 중량 (g) 입력 */}
                            <div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-extrabold text-cyan-300">
                                  실측 입고 모재 중량 (g){" "}
                                  <span className="text-rose-400">*</span>
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  고객 신청: {requestedGrams.toLocaleString()}g (
                                  {Number(selectedOrder.weight).toFixed(2)}kg)
                                </span>
                              </div>
                              <div className="relative mt-1.5">
                                <input
                                  type="number"
                                  step="1"
                                  min="1"
                                  required={editStep === 1}
                                  value={actualWeightGrams}
                                  onChange={(e) =>
                                    setActualWeightGrams(e.target.value)
                                  }
                                  placeholder="실제 저울에 찍힌 그램(g) 입력 (예: 1960)"
                                  className="w-full rounded-xl border border-cyan-400/60 bg-slate-900 py-2.5 pr-28 pl-3.5 font-mono text-sm font-black text-cyan-300 focus:border-cyan-300 focus:outline-none"
                                />
                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs font-bold text-slate-300">
                                  g ({(measuredGramsNum / 1000).toFixed(3)}kg)
                                </span>
                              </div>
                              {measuredGramsNum > 0 && (
                                <p className="mt-1 text-[11px] text-slate-300">
                                  신청 대비 실측 편차:{" "}
                                  <strong
                                    className={
                                      weightDiffGrams >= 0
                                        ? "text-emerald-400"
                                        : "text-amber-400"
                                    }
                                  >
                                    {weightDiffGrams >= 0
                                      ? `+${weightDiffGrams.toLocaleString()}g`
                                      : `${weightDiffGrams.toLocaleString()}g`}
                                  </strong>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* =====================================================
                          [STEP 03 전용 필수 입력 박스]: 최종 추출 순금 비드 중량(g)
                      ===================================================== */}
                      {editStep === 3 && (
                        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300">
                              <Coins className="h-4 w-4 text-amber-400" />
                              <span>
                                [STEP 03 필수 검수] 실제 추출된 순금 비드(Gold
                                Button) 확정 중량(g) 입력
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-300">
                              고객 시뮬레이션 예상치:{" "}
                              {selectedOrder.expected_gold}g
                            </span>
                          </div>
                          <div className="relative mt-2.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              required={editStep === 3}
                              value={editActualGold}
                              onChange={(e) =>
                                setEditActualGold(e.target.value)
                              }
                              placeholder="전자저울에 측정된 최종 순금 비드 중량 입력 (예: 12.45)"
                              className="w-full rounded-xl border border-amber-400 bg-slate-900 py-2.5 pr-16 pl-3.5 font-mono text-sm font-black text-amber-300 focus:outline-none"
                            />
                            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-xs font-bold text-amber-400">
                              g (순금)
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-amber-200/80">
                            ※ 입력하신 확정 그램(g)이 고객의 누적 금 추출량에
                            즉시 합산됩니다.
                          </p>
                        </div>
                      )}

                      {/* =====================================================
                          [STEP 04 전용 필수 정산·출고 검수 박스]:
                          정산 방식(현금 계좌이체 vs 순금 실물 수령)별 맞춤 정보 & 자동완성
                      ===================================================== */}
                      {editStep === 4 && (
                        <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4">
                          {selectedOrder.settlement_type === "cash_transfer" ? (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
                                  <CreditCard className="h-4 w-4 text-emerald-400" />
                                  <span>
                                    [STEP 04 현금 정산·송금 필수 검수] 입금 계좌 ·
                                    세무사 원천징수 신고 정보 ·{" "}
                                    {isGoldConfirmed
                                      ? "확정 실송금액"
                                      : "예상 실송금액 (추출 실측 전)"}
                                  </span>
                                </div>
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                                    !selectedOrder.account_holder ||
                                    selectedOrder.account_holder.trim() ===
                                      selectedOrder.client_name.trim()
                                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                      : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                  }`}
                                >
                                  {!selectedOrder.account_holder ||
                                  selectedOrder.account_holder.trim() ===
                                    selectedOrder.client_name.trim()
                                    ? "✓ 의뢰인 = 예금주 본인 명의 일치"
                                    : `⚠️ 명의 불일치 주의 (${selectedOrder.client_name} ≠ ${selectedOrder.account_holder})`}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {/* 1. 송금 대상 계좌 정보 */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-400">
                                      1) 고객 정산 입금계좌
                                    </span>
                                    {selectedOrder.bank_account && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            typeof navigator !== "undefined" &&
                                            navigator.clipboard
                                          ) {
                                            navigator.clipboard.writeText(
                                              `${selectedOrder.bank_name || ""} ${selectedOrder.bank_account || ""}`.trim()
                                            );
                                            setSaveFeedback({
                                              type: "ok",
                                              msg: "📋 고객 입금 계좌번호가 클립보드에 복사되었습니다.",
                                            });
                                          }
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-slate-700"
                                      >
                                        <Copy className="h-3 w-3" />
                                        <span>계좌복사</span>
                                      </button>
                                    )}
                                  </div>
                                  <p className="mt-1 font-mono text-sm font-black text-white">
                                    {selectedOrder.bank_name || "은행 미지정"}{" "}
                                    {selectedOrder.bank_account || "계좌 미입력"}
                                  </p>
                                  <p className="mt-0.5 text-xs font-bold text-emerald-300">
                                    예금주:{" "}
                                    {selectedOrder.account_holder ||
                                      selectedOrder.client_name}
                                  </p>
                                </div>

                                {/* 2. 세무사 신고용 원천징수 & 신분증 사본 확인 */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                                  <span className="text-[11px] font-bold text-slate-400">
                                    2) 세무사 신고 · 신분증 사본
                                  </span>
                                  <p className="mt-1 text-xs font-extrabold text-amber-300">
                                    {selectedOrder.tax_option_label ||
                                      "개인 표준 3.3% 사업소득 원천징수"}
                                  </p>
                                  {selectedOrder.business_number ? (
                                    <p className="mt-0.5 font-mono text-xs font-bold text-cyan-300">
                                      사업자번호: {selectedOrder.business_number}
                                    </p>
                                  ) : (
                                    <p className="mt-0.5 font-mono text-xs font-bold text-cyan-300">
                                      생년월일(6자리):{" "}
                                      {selectedOrder.resident_birth_prefix ||
                                        "미입력 (신분증 확인)"}
                                    </p>
                                  )}
                                  <div className="mt-1.5">
                                    {selectedOrder.id_card_url ? (
                                      <a
                                        href={`${selectedOrder.id_card_url}${
                                          selectedOrder.id_card_url.includes(
                                            "?"
                                          )
                                            ? "&"
                                            : "?"
                                        }adminPin=${encodeURIComponent(
                                          adminPin
                                        )}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-extrabold text-cyan-200 hover:bg-cyan-500/25"
                                      >
                                        <FileCheck2 className="h-3.5 w-3.5 text-cyan-300" />
                                        <span>업로드된 신분증 사본 열람 (보안인증)</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : selectedOrder.tax_option ===
                                      "business_invoice" ? (
                                      <span className="text-[11px] text-slate-400">
                                        사업자 세금계산서 발행 대상
                                      </span>
                                    ) : (
                                      <span className="inline-block rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                        ⚠️ 송금 전 신분증 사본 수령 확인 (
                                        {selectedOrder.id_card_method ===
                                        "send_before_payout"
                                          ? "정산 전 별도 제출 선택"
                                          : "미첨부"}
                                        )
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 3. 확정 순금 기준 세전/세후 실지급액 자동 계산 */}
                                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-bold text-emerald-200">
                                      {isGoldConfirmed
                                        ? `3) 실측 확정 금(${settlementGoldGrams}g) 정산액`
                                        : `3) 예상 금(${settlementGoldGrams}g) 정산액 (추출 실측 전 가계산)`}
                                    </span>
                                    <span className="font-mono text-[11px] text-slate-300">
                                      매입시세: <strong className="text-amber-300">₩{formatKRW(settlementBuyPrice)}/g</strong>
                                      <span className="text-[10px] text-slate-400"> (KRX 97.5%)</span>
                                    </span>
                                  </div>
                                  <div className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                                    <div className="flex justify-between">
                                      <span>세전 금 매입가액:</span>
                                      <span className="font-mono font-bold text-white">
                                        ₩{formatKRW(settlementCashGross)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-amber-300">
                                      <span>
                                        {isWithholding33Order
                                          ? isGoldConfirmed
                                            ? "3.3% 사업소득 원천징수 공제:"
                                            : "3.3% 원천징수 공제 (예상):"
                                          : isGoldConfirmed
                                            ? "원천징수 세액:"
                                            : "원천징수 세액 (예상):"}
                                      </span>
                                      <span className="font-mono font-bold">
                                        -₩{formatKRW(settlementWithholdingTax)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                                      <span>선입금 작업비 (기결제 확인):</span>
                                      <span className="font-mono">₩{formatKRW(settlementWorkFee)} (선입금 완료)</span>
                                    </div>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between border-t border-emerald-500/30 pt-1.5">
                                    <span className="text-xs font-extrabold text-emerald-300">
                                      {isGoldConfirmed
                                        ? "최종 이체 확정 실지급액"
                                        : "이체 예상 실지급액 (실측 전)"}
                                    </span>
                                    <span className="font-mono text-base font-black text-emerald-400">
                                      ₩{formatKRW(settlementFinalCashPayout)}
                                    </span>
                                  </div>
                                  <div className="mt-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2 py-1 text-[10px] text-slate-300">
                                    <p className="text-emerald-300 font-bold">
                                      💡 의뢰인 최종 실수익: ₩{formatKRW(settlementNetClientProfit)}
                                      <span className="font-normal text-slate-300"> (실송금 ₩{formatKRW(settlementFinalCashPayout)} - 선입금 작업비 ₩{formatKRW(settlementWorkFee)})</span>
                                    </p>
                                    <p className="mt-0.5 text-slate-400 text-[9.5px]">
                                      ※ 작업비는 STEP 01에서 이미 선입금 받았으므로 이중 차감하지 않고 금 매입대금 전액을 송금합니다. (매입시세: KRX 기준가의 97.5% 적용)
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-300">
                                  💡 계좌이체 완료 후 아래 자동 채우기 버튼을
                                  누르면 송금 내역이 STEP 04 기록란에 즉시
                                  입력됩니다. (이체확인증 캡처도 R2 첨부 가능)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const bankInfo = `${selectedOrder.bank_name || ""} ${selectedOrder.bank_account || ""} (예금주: ${selectedOrder.account_holder || selectedOrder.client_name})`.trim();
                                    const taxDesc = isWithholding33Order
                                      ? `3.3% 사업소득 원천징수(₩${formatKRW(settlementWithholdingTax)}) 공제 후`
                                      : `${selectedOrder.tax_option_label || "세법 기준"} 적용 후`;
                                    const goldLabel = isGoldConfirmed ? "확정 금" : "예상 금";
                                    const payoutLabel = isGoldConfirmed ? "최종 실지급액" : "예상 실지급액";
                                    setLogTitle(
                                      "현금 정산 계좌이체 송금 완료 (정련 1사이클 최종 마감)"
                                    );
                                    setMeasuredValue(
                                      `${payoutLabel} ₩${formatKRW(settlementFinalCashPayout)} 송금 완료 (${goldLabel} ${settlementGoldGrams}g)`
                                    );
                                    setLogDetail(
                                      `${goldLabel} 추출 순금 ${settlementGoldGrams}g에 대해 ${taxDesc} ${payoutLabel} ₩${formatKRW(settlementFinalCashPayout)}을 고객 지정 계좌[${bankInfo}]로 이체 완료하여 정련 1사이클이 최종 마감되었습니다.`
                                    );
                                  }}
                                  className="rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/30"
                                >
                                  ⚡ 계좌이체 정산 완료 내역 자동 채우기
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-300">
                                  <Truck className="h-4 w-4 text-amber-400" />
                                  <span>
                                    [STEP 04 순금 실물(Gold Button) 출고 필수
                                    검수] 수령 방식 · 카카오 우편번호 주소 ·
                                    운송장 입력
                                  </span>
                                </div>
                                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                                  {selectedOrder.delivery_method === "visit"
                                    ? "🏢 평택 정련실 방문 수령"
                                    : "🚚 우체국 안심소포(보험등기) 택배 발송"}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* 1. 배송지 주소 또는 방문 수령 안내 */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-400">
                                      1) 출고 대상 순금 비드 및 수령지
                                    </span>
                                    {selectedOrder.delivery_method !==
                                      "visit" &&
                                      selectedOrder.road_address && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (
                                              typeof navigator !==
                                                "undefined" &&
                                              navigator.clipboard
                                            ) {
                                              navigator.clipboard.writeText(
                                                `[${selectedOrder.zonecode || ""}] ${selectedOrder.road_address || ""} ${selectedOrder.detail_address || ""}`.trim()
                                              );
                                              setSaveFeedback({
                                                type: "ok",
                                                msg: "📋 배송지 주소가 클립보드에 복사되었습니다.",
                                              });
                                            }
                                          }}
                                          className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-slate-700"
                                        >
                                          <Copy className="h-3 w-3" />
                                          <span>주소복사</span>
                                        </button>
                                      )}
                                  </div>
                                  <p className="mt-1 text-xs font-extrabold text-amber-300">
                                    출고 순금 비드{" "}
                                    {isGoldConfirmed
                                      ? "확정 중량:"
                                      : "예상 중량 (추출 실측 전):"}{" "}
                                    {settlementGoldGrams}g (순도 98.5~99.5%)
                                  </p>
                                  {selectedOrder.delivery_method === "visit" ? (
                                    <p className="mt-1 text-xs text-slate-200">
                                      • 평택 정련실 고객 직접 방문 수령 (본인
                                      신분증 대조 후 인계)
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-xs text-white">
                                      [{selectedOrder.zonecode || "-"}]{" "}
                                      {selectedOrder.road_address ||
                                        "주소 미입력"}{" "}
                                      <strong className="text-amber-300">
                                        {selectedOrder.detail_address || ""}
                                      </strong>
                                    </p>
                                  )}
                                </div>

                                {/* 2. 등기운송장 번호 입력 및 자동 채우기 */}
                                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                                  <label className="block text-[11px] font-bold text-slate-300">
                                    2){" "}
                                    {selectedOrder.delivery_method === "visit"
                                      ? "방문 수령 확인자 / 인계 메모"
                                      : "우체국 안심소포 등기운송장 번호 입력"}
                                  </label>
                                  <input
                                    type="text"
                                    value={trackingNumber}
                                    onChange={(e) =>
                                      setTrackingNumber(e.target.value)
                                    }
                                    placeholder={
                                      selectedOrder.delivery_method === "visit"
                                        ? "예: 본인 신분증 확인 후 현장 직접 인계 완료"
                                        : "예: 우체국 안심소포 68901-2345-6789"
                                    }
                                    className="mt-1.5 w-full rounded-lg border border-amber-500/40 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                                  />
                                  <div className="mt-2 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (
                                          selectedOrder.delivery_method ===
                                          "visit"
                                        ) {
                                          setLogTitle(
                                            "순금 비드(Gold Button) 평택 정련실 방문 수령 인계 완료 (1사이클 마감)"
                                          );
                                          setMeasuredValue(
                                            `순금 비드 ${settlementGoldGrams}g 현장 직접 인계 완료`
                                          );
                                          setLogDetail(
                                            `추출 완료된 고순도 순금 비드 ${settlementGoldGrams}g을 평택 정련실에서 의뢰인 본인 확인 후 직접 인계 완료하여 본 의뢰 건이 최종 마감되었습니다.${trackingNumber.trim() ? ` (${trackingNumber.trim()})` : ""}`
                                          );
                                        } else {
                                          const trk =
                                            trackingNumber.trim() ||
                                            "우체국 안심소포 보험등기";
                                          const addr =
                                            `${selectedOrder.road_address || ""} ${selectedOrder.detail_address || ""}`.trim();
                                          setLogTitle(
                                            "순금 비드(Gold Button) 우체국 안심소포 발송 완료 (1사이클 마감)"
                                          );
                                          setMeasuredValue(
                                            `순금 비드 ${settlementGoldGrams}g 발송 완료 (${trk})`
                                          );
                                          setLogDetail(
                                            `추출 완료된 고순도 순금 비드 ${settlementGoldGrams}g을 고객 지정 배송지[${addr}]로 우체국 안심소포(${trk}) 발송 완료하여 정련 1사이클이 최종 마감되었습니다.`
                                          );
                                        }
                                      }}
                                      className="rounded-lg border border-amber-400/50 bg-amber-500/20 px-3 py-1.5 text-[11px] font-extrabold text-amber-200 hover:bg-amber-500/30"
                                    >
                                      ⚡ 안심소포 발송 / 방문 인계 내역 자동
                                      채우기
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* =====================================================
                          공통 입력: 단계 제목 / 계측 요약 배지 / 상세 설명
                      ===================================================== */}
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-300">
                            STEP 0{editStep} 공식 기록 제목
                          </label>
                          <input
                            type="text"
                            value={logTitle}
                            onChange={(e) => setLogTitle(e.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold text-slate-300">
                            핵심 계측 요약 배지 (미입력 시 실측값 자동 생성)
                          </label>
                          <input
                            type="text"
                            value={measuredValue}
                            onChange={(e) => setMeasuredValue(e.target.value)}
                            placeholder={
                              STEP_CONFIGS.find((c) => c.step === editStep)
                                ?.measuredHint
                            }
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-bold text-slate-300">
                          상세 작업 코멘트
                        </label>
                        <textarea
                          rows={2}
                          value={logDetail}
                          onChange={(e) => setLogDetail(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      {/* =====================================================
                          단계별 현장 사진 / 영상 업로드 및 오업로드 개별 삭제 (Cloudflare R2)
                      ===================================================== */}
                      <div className="mt-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/70 p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                            <Upload className="h-4 w-4 text-cyan-400" />
                            <span>
                              STEP 0{editStep} 현장 증빙 사진 · 영상 첨부 및
                              관리 (Cloudflare R2 저장, 최대 3개)
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            잘못 올린 사진/영상은 우측 상단 [삭제] 버튼으로 즉시
                            제거 가능
                          </span>
                        </div>

                        {/* 이미 이 단계에 등록되어 있는 미디어 목록 + 개별 삭제 버튼 */}
                        {retainedMediaUrls.length > 0 && (
                          <div className="mt-2.5 rounded-xl border border-slate-800 bg-slate-950/90 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-emerald-300">
                                현재 STEP 0{editStep}에 등록된 사진·영상 (
                                {retainedMediaUrls.length}개)
                              </span>
                              <span className="text-[10px] text-slate-400">
                                🗑️ 클릭 시 R2 스토리지 및 타임라인에서 즉시 삭제
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {retainedMediaUrls.map((mUrl, idx) => (
                                <div
                                  key={mUrl + idx}
                                  className="group relative overflow-hidden rounded-lg border border-slate-700 bg-black"
                                >
                                  {isVideoUrl(mUrl) ? (
                                    <video
                                      src={mUrl}
                                      controls
                                      playsInline
                                      className="h-24 w-36 object-contain"
                                    />
                                  ) : (
                                    <a
                                      href={mUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block h-24 w-32"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={mUrl}
                                        alt={`STEP 0${editStep} 등록 미디어 ${idx + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    disabled={deletingMediaUrl === mUrl}
                                    onClick={() =>
                                      handleDeleteSingleMedia(editStep, mUrl)
                                    }
                                    title="이 사진/영상 삭제"
                                    className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600/95 px-2 py-1 text-[10px] font-extrabold text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>
                                      {deletingMediaUrl === mUrl
                                        ? "삭제중..."
                                        : "삭제"}
                                    </span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <input
                          ref={mediaInputRef}
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/quicktime"
                          multiple
                          onChange={handleMediaSelect}
                          className="mt-2.5 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-cyan-300 hover:file:bg-cyan-500/30"
                        />

                        {mediaFiles.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {mediaFiles.map((f, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-2.5 py-1 text-[11px] font-semibold text-cyan-200"
                              >
                                {f.type.startsWith("video") ? (
                                  <Video className="h-3 w-3" />
                                ) : (
                                  <ImageIcon className="h-3 w-3" />
                                )}
                                <span>
                                  {f.name} (
                                  {(f.size / (1024 * 1024)).toFixed(2)}MB)
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMediaFiles((prev) =>
                                      prev.filter((_, idx) => idx !== i)
                                    )
                                  }
                                  className="ml-1 rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-200 hover:bg-rose-500/50"
                                >
                                  ✕ 취소
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        {saveFeedback ? (
                          <span
                            className={`text-xs font-bold ${
                              saveFeedback.type === "ok"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            {saveFeedback.msg}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {editStep === 4
                              ? "※ STEP 04 저장 시 1사이클이 최종 마감(잠금) 처리됩니다."
                              : `※ 이미 등록된 STEP 0${editStep} 기록이 있으면 중복 누적되지 않고 최신 내용으로 덮어씁니다.`}
                          </span>
                        )}

                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
                        >
                          {saving
                            ? "Cloudflare R2 & D1 저장 중..."
                            : editStep === 4
                              ? "STEP 04 정산 완료 및 1사이클 최종 마감하기"
                              : `STEP 0${editStep} 완료 기록 & R2 미디어 저장`}
                        </button>
                      </div>
                    </form>

                    {/* 고객이 접수 시 업로드한 모재 사진 */}
                    {parsedClientPhotos.length > 0 && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                        <p className="mb-2 text-xs font-bold text-slate-300">
                          의뢰인이 접수 시 업로드한 모재 사진 (
                          {parsedClientPhotos.length}장)
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {parsedClientPhotos.map((u, i) => (
                            <a
                              key={i}
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-20 w-28 overflow-hidden rounded-xl border border-slate-700"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={u}
                                alt={`고객 모재 ${i + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 4) 1사이클 4단계 공식 기록 현황판 */}
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
                        <Layers className="h-4 w-4 text-amber-400" />
                        <span>
                          본 주문의 1사이클 4단계 공식 기록 현황 (사진·영상 개별
                          삭제 가능)
                        </span>
                      </h4>
                      <div className="space-y-3">
                        {STEP_CONFIGS.map((cfg) => {
                          const stepLog = activeLogs.find(
                            (l) => Number(l.step_number) === cfg.step
                          );
                          const mediaUrls = parseMediaUrls(stepLog?.photo_url);
                          return (
                            <div
                              key={cfg.step}
                              className={`rounded-xl border p-3.5 ${
                                stepLog
                                  ? "border-emerald-500/30 bg-slate-950/90"
                                  : "border-slate-800/70 bg-slate-950/40 opacity-60"
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-amber-300">
                                  [{cfg.badge}]{" "}
                                  {stepLog ? stepLog.log_title : "미등록 (대기중)"}
                                </span>
                                <div className="flex items-center gap-2">
                                  {stepLog && (
                                    <span className="text-[11px] text-slate-500">
                                      {stepLog.created_at}
                                    </span>
                                  )}
                                  {(!isOrderCycleLocked || forceUnlock) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStepTabClick(cfg.step)
                                      }
                                      className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-slate-700"
                                    >
                                      {stepLog ? "수정" : "입력하기"}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {stepLog && (
                                <>
                                  <p className="mt-1 text-xs text-slate-300">
                                    {stepLog.log_detail}
                                  </p>
                                  {stepLog.measured_value && (
                                    <span className="mt-2 inline-block rounded bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                                      {stepLog.measured_value}
                                    </span>
                                  )}
                                  {mediaUrls.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-2.5">
                                      {mediaUrls.map((mUrl, mIdx) => (
                                        <div
                                          key={mUrl + mIdx}
                                          className="relative overflow-hidden rounded-lg border border-slate-700 bg-black"
                                        >
                                          {isVideoUrl(mUrl) ? (
                                            <video
                                              src={mUrl}
                                              controls
                                              playsInline
                                              className="h-28 w-44 object-contain"
                                            />
                                          ) : (
                                            <a
                                              href={mUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block h-24 w-32"
                                            >
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img
                                                src={mUrl}
                                                alt={`STEP ${cfg.step} 미디어`}
                                                className="h-full w-full object-cover"
                                              />
                                            </a>
                                          )}
                                          <button
                                            type="button"
                                            disabled={deletingMediaUrl === mUrl}
                                            onClick={() =>
                                              handleDeleteSingleMedia(
                                                cfg.step,
                                                mUrl
                                              )
                                            }
                                            title="잘못 업로드된 사진/영상 삭제"
                                            className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600/95 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                            <span>
                                              {deletingMediaUrl === mUrl
                                                ? "삭제중"
                                                : "삭제"}
                                            </span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                    좌측 목록에서 관리할 의뢰 건을 선택해 주세요.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
