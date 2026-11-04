"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  FlaskConical,
  Coins,
  AlertTriangle,
  ShieldCheck,
  X,
  History,
  Award,
  Sparkles,
  ChevronRight,
  Layers,
  Scale,
  Video,
  Image as ImageIcon,
} from "lucide-react";
import { formatKRW } from "@/lib/refining-calc";

export interface OrderRecord {
  id?: number;
  receipt_number: string;
  submitted_at: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  track?: string;
  track_name: string;
  weight: number;
  actual_weight?: number | null;
  payment_confirmed?: number;
  preprocess_label: string;
  purity_label: string;
  settlement_type: string;
  delivery_method?: string;
  zonecode?: string;
  road_address?: string;
  detail_address?: string;
  bank_name?: string;
  bank_account?: string;
  account_holder?: string;
  tax_option?: string;
  tax_option_label?: string;
  business_number?: string;
  resident_birth_prefix?: string;
  id_card_method?: string;
  id_card_url?: string;
  withholding_tax_amount?: number;
  final_cash_payout?: number;
  expected_gold: number;
  actual_gold: number | null;
  gold_price: number;
  final_work_fee: number;
  total_gold_value_v: number;
  net_client_profit: number;
  photo_urls_json: string;
  status: string;
  current_step: number;
  is_cycle_locked?: number;
}

export interface OrderLogRecord {
  id: number;
  receipt_number: string;
  step_number: number;
  stage_label: string;
  log_title: string;
  log_detail: string;
  operator_name: string;
  measured_value: string | null;
  photo_url: string | null;
  created_at: string;
}

interface CustomerSummary {
  totalOrders: number;
  totalWeightKg: number;
  confirmedGoldGrams: number;
  totalGoldGrams: number;
  totalNetProfit: number;
}

interface ClientTrackerViewProps {
  initialEmail?: string;
  initialPhone?: string;
  initialPassword?: string;
  onClose: () => void;
}

export function deduplicateUrlArray(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of urls) {
    const clean = String(raw || "").trim();
    if (!clean) continue;
    const decoded = decodeURIComponent(clean);
    const normalized = decoded
      .replace(/\/step_(\d+)_\d+_\d+_/g, "/step_$1_")
      .replace(/\/client_\d+_\d+_/g, "/client_");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(clean);
    }
  }
  return unique;
}

export function parseMediaUrls(rawPhotoUrl: string | null | undefined): string[] {
  if (!rawPhotoUrl) return [];
  const trimmed = rawPhotoUrl.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr) ? deduplicateUrlArray(arr.filter(Boolean)) : [];
    } catch {
      return [];
    }
  }
  return [trimmed];
}

export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.includes(".mp4?") ||
    lower.includes(".mov?") ||
    lower.includes(".webm?")
  );
}

export default function ClientTrackerView({
  initialEmail = "",
  initialPhone = "",
  initialPassword = "",
  onClose,
}: ClientTrackerViewProps) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [password, setPassword] = useState(initialPassword);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<OrderRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<string>("");
  const [logsByReceipt, setLogsByReceipt] = useState<
    Record<string, OrderLogRecord[]>
  >({});
  const [customerSummary, setCustomerSummary] =
    useState<CustomerSummary | null>(null);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(
          data.error ||
            "일치하는 의뢰 내역을 찾을 수 없습니다. 입력 정보를 확인해 주세요."
        );
        setAllOrders([]);
        return;
      }

      const ordersList: OrderRecord[] =
        data.allOrders && data.allOrders.length > 0
          ? data.allOrders
          : data.order
            ? [data.order]
            : [];

      setAllOrders(ordersList);
      if (ordersList.length > 0) {
        setSelectedReceipt(ordersList[0].receipt_number);
      }

      if (data.logsByReceipt) {
        setLogsByReceipt(data.logsByReceipt);
      } else if (data.order && data.logs) {
        setLogsByReceipt({ [data.order.receipt_number]: data.logs });
      }

      if (data.customerSummary) {
        setCustomerSummary(data.customerSummary);
      }
    } catch {
      setError("네트워크 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialEmail && initialPhone && initialPassword) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeOrder: OrderRecord | null =
    allOrders.find((o) => o.receipt_number === selectedReceipt) ||
    allOrders[0] ||
    null;

  const activeLogs: OrderLogRecord[] = activeOrder
    ? logsByReceipt[activeOrder.receipt_number] || []
    : [];

  const parsedClientPhotos: string[] = (() => {
    if (!activeOrder?.photo_urls_json) return [];
    try {
      const arr = JSON.parse(activeOrder.photo_urls_json);
      return Array.isArray(arr) ? deduplicateUrlArray(arr) : [];
    } catch {
      return [];
    }
  })();

  const stepDefinitions = [
    {
      num: 1,
      title: "STEP 01 · 입금확인 & 모재 실측 계량",
      desc: "작업비 입금 확인 및 택배/방문 입고 모재 전자저울 실측 완료",
    },
    {
      num: 2,
      title: "STEP 02 · 단독 배치 습식 침출·환원",
      desc: "의뢰인 단독 반응조 약품 투입 및 고순도 금 선택 침전 완료",
    },
    {
      num: 3,
      title: "STEP 03 · 순금 비드 추출 & 중량 검수",
      desc: "도가니 고온 용융 골드 버튼 성형 및 0.01g 단위 확정 계량",
    },
    {
      num: 4,
      title: "STEP 04 · 최종 정산 및 출고 마감",
      desc: "우체국 안심소포 발송 또는 당일 시세 현금 송금 (1사이클 종료)",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/85 backdrop-blur-xl sm:items-center sm:p-4">
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-800/90 bg-[#0B0F17] shadow-2xl sm:rounded-3xl">
        {/* 상단 바 */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-800/80 bg-[#0B0F17]/95 px-5 py-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/20 to-amber-600/5 text-amber-400 shadow-inner">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                  CLIENT REFINERY PORTAL
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  R2 영상·사진 실시간 연동
                </span>
              </div>
              <h2 className="text-base font-extrabold text-white sm:text-lg">
                의뢰인 전용 4단계 공정 검수 & 누적 추출량 조회
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-7">
          {/* 1. 로그인/조회 입력 폼 */}
          <form
            onSubmit={handleLookup}
            className="rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                의뢰 시 등록한{" "}
                <strong>이메일 + 전화번호 + 6자리 비밀번호</strong>로 단계별
                계량 사진·영상 및 누적 금 추출량을 확인하실 수 있습니다.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 주소"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 py-2.5 pr-3 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="relative">
                <Phone className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-slate-500" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="연락처 (010-XXXX-XXXX)"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-950 py-2.5 pr-3 pl-10 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="relative">
                <Lock className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-amber-400" />
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value.toUpperCase())}
                  placeholder="비밀번호 6자리"
                  className="w-full rounded-xl border border-amber-500/40 bg-slate-950 py-2.5 pr-3 pl-10 font-mono text-sm font-bold tracking-widest text-amber-300 uppercase placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                <span>{loading ? "조회 중..." : "내역 및 로그 조회"}</span>
              </button>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}
          </form>

          {/* 2. 조회 결과 영역 */}
          {activeOrder && customerSummary && (
            <div className="mt-6 space-y-6">
              {/* [A] 고객 누적 정련 & 누적 금 추출량 요약 배너 */}
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/95 to-slate-950 p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-400" />
                    <span className="text-sm font-extrabold text-white">
                      {activeOrder.client_name} 의뢰인님의 누적 정련 리포트
                    </span>
                  </div>
                  <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-0.5 text-xs font-bold text-amber-300">
                    총 {customerSummary.totalOrders}회 위탁 고객
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                    <p className="text-[11px] font-medium text-slate-400">
                      총 누적 의뢰 건수
                    </p>
                    <p className="mt-1 text-lg font-black text-white sm:text-xl">
                      {customerSummary.totalOrders} 건
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      누적 모재 {customerSummary.totalWeightKg.toFixed(2)}kg
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-amber-300">
                        누적 금 추출량 (총합)
                      </p>
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <p className="mt-1 text-xl font-black text-amber-400 sm:text-2xl">
                      {customerSummary.totalGoldGrams.toFixed(2)} g
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-200/80">
                      확정 추출:{" "}
                      <strong>
                        {customerSummary.confirmedGoldGrams.toFixed(2)}g
                      </strong>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                    <p className="text-[11px] font-medium text-slate-400">
                      누적 정산 순수익
                    </p>
                    <p className="mt-1 text-base font-black text-emerald-400 sm:text-lg">
                      ₩{formatKRW(customerSummary.totalNetProfit)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      수수료 차감 후 의뢰인 귀속분
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3.5">
                    <p className="text-[11px] font-medium text-slate-400">
                      고객 식별 계정
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-200">
                      {activeOrder.client_email}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {activeOrder.client_phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* [B] 전체 주문 내역 선택 리스트 */}
              <div>
                <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
                  <History className="h-4 w-4 text-cyan-400" />
                  <span>
                    나의 전체 주문 내역 ({allOrders.length}건 · 클릭하여 주문별
                    진행상태 확인)
                  </span>
                </h3>

                <div className="flex gap-2.5 overflow-x-auto pb-2">
                  {allOrders.map((ord, idx) => {
                    const isSelected =
                      ord.receipt_number === activeOrder.receipt_number;
                    const step = Number(ord.current_step ?? 0);
                    const isDone = step >= 4 || ord.status === "COMPLETED";
                    return (
                      <button
                        key={ord.receipt_number}
                        type="button"
                        onClick={() => setSelectedReceipt(ord.receipt_number)}
                        className={`group flex min-w-[235px] shrink-0 flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                          isSelected
                            ? "border-amber-400 bg-amber-500/15 shadow-md shadow-amber-500/10"
                            : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-extrabold text-amber-300">
                            {ord.receipt_number}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isDone
                                ? "bg-emerald-500/20 text-emerald-300"
                                : step === 0
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-cyan-500/20 text-cyan-300"
                            }`}
                          >
                            {isDone
                              ? "1사이클 완료"
                              : step === 0
                                ? "입금·입고 대기"
                                : `STEP 0${step} 완료`}
                          </span>
                        </div>
                        <div className="mt-2 text-xs font-bold text-white">
                          {ord.track_name} ·{" "}
                          {ord.actual_weight !== null &&
                          ord.actual_weight !== undefined
                            ? `실측 ${Number(ord.actual_weight).toFixed(2)}kg`
                            : `신청 ${Number(ord.weight).toFixed(2)}kg`}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {ord.actual_gold !== null &&
                            ord.actual_gold !== undefined
                              ? `확정 금: ${ord.actual_gold}g`
                              : `예상 금: ${ord.expected_gold}g`}
                          </span>
                          <span className="inline-flex items-center text-amber-400">
                            #{allOrders.length - idx}회차
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* [C] 현재 선택된 주문 상세 요약 & 실측 모재 계량 비교 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-extrabold text-amber-300">
                        {activeOrder.receipt_number}
                      </span>
                      {Number(activeOrder.payment_confirmed || 0) === 1 ||
                      Number(activeOrder.current_step || 0) >= 1 ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                          ✓ 작업비 입금 확인 완료
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                          입금 및 모재 입고 대기중
                        </span>
                      )}
                      {Number(activeOrder.current_step || 0) >= 4 && (
                        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
                          🔒 1사이클 정산 완료
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-base font-extrabold text-white sm:text-lg">
                      {activeOrder.track_name}
                    </h3>
                  </div>

                  <div className="text-right text-xs text-slate-400">
                    <div>접수일시: {activeOrder.submitted_at}</div>
                    <div className="mt-0.5 font-semibold text-amber-300">
                      {activeOrder.purity_label}
                    </div>
                  </div>
                </div>

                {/* 신청 중량 vs 정련실 실측 중량 & 추출 금 중량 핵심 비교 카드 */}
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
                    <p className="text-[11px] text-slate-400">
                      ① 고객 신청 모재 중량
                    </p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-200">
                      {Number(activeOrder.weight).toFixed(2)} kg (
                      {Math.round(
                        Number(activeOrder.weight) * 1000
                      ).toLocaleString()}
                      g)
                    </p>
                  </div>

                  <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/20 p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-cyan-300">
                        ② 정련실 실측 모재 중량
                      </p>
                      <Scale className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    {activeOrder.actual_weight !== null &&
                    activeOrder.actual_weight !== undefined ? (
                      <p className="mt-1 font-mono text-sm font-extrabold text-cyan-300">
                        {Number(activeOrder.actual_weight).toFixed(3)} kg (
                        {Math.round(
                          Number(activeOrder.actual_weight) * 1000
                        ).toLocaleString()}
                        g)
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        입고 후 전자저울 실측 예정
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-amber-300">
                        ③ 순금 비드 추출 중량
                      </p>
                      <Coins className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <p className="mt-1 font-mono text-sm font-extrabold text-amber-300">
                      {activeOrder.actual_gold !== null &&
                      activeOrder.actual_gold !== undefined
                        ? `확정 ${Number(activeOrder.actual_gold).toFixed(2)} g`
                        : `예상 약 ${activeOrder.expected_gold} g`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
                    <p className="text-[11px] font-bold text-emerald-300">
                      ④ 의뢰인 정산 순수익
                    </p>
                    <p className="mt-1 font-mono text-sm font-extrabold text-emerald-300">
                      ₩{formatKRW(activeOrder.net_client_profit)}
                    </p>
                  </div>
                </div>

                {/* 정산 방식별 상세 정보 (택배 주소 또는 입금계좌 + 세금공제 내역) */}
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs">
                  {activeOrder.settlement_type === "cash_transfer" ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-emerald-300">
                          💳 현금 정산 입금계좌 및 세법 원천징수 확인 내역
                        </span>
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                          ✓ 의뢰인 명의 계좌 일치 확인됨
                        </span>
                      </div>
                      <p className="text-slate-300">
                        • <strong>정산 계좌:</strong>{" "}
                        {activeOrder.bank_name || "-"} /{" "}
                        <span className="font-mono font-bold text-white">
                          {activeOrder.bank_account || "-"}
                        </span>{" "}
                        (예금주: {activeOrder.account_holder || activeOrder.client_name})
                      </p>
                      <p className="text-slate-300">
                        • <strong>적용 세법 구분:</strong>{" "}
                        {activeOrder.tax_option_label ||
                          "개인 원천징수(3.3%) 또는 지출증빙 확인"}
                        {activeOrder.business_number
                          ? ` (사업자번호: ${activeOrder.business_number})`
                          : ""}
                      </p>
                      <p className="text-slate-300">
                        • <strong>공제 세액 및 세후 실입금액:</strong> 원천징수 공제{" "}
                        <span className="font-mono font-semibold text-amber-300">
                          ₩{formatKRW(Number(activeOrder.withholding_tax_amount || 0))}
                        </span>{" "}
                        ➔ 세후 실송금 예정액{" "}
                        <span className="font-mono font-extrabold text-emerald-400">
                          ₩
                          {formatKRW(
                            Number(
                              activeOrder.final_cash_payout ||
                                activeOrder.net_client_profit
                            )
                          )}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="font-bold text-amber-300">
                        📦 순금 실물(Gold Button) 수령 방식 및 배송지
                      </span>
                      {activeOrder.delivery_method === "visit" ? (
                        <p className="text-slate-300">
                          • 평택 정련실 직접 방문 수령 (경기도 평택시 고덕면 도시지원1길 116, 208호)
                        </p>
                      ) : (
                        <p className="text-slate-300">
                          • 우체국 안심소포(보험등기) 배송지:{" "}
                          <span className="font-semibold text-white">
                            [{activeOrder.zonecode || "-"}]{" "}
                            {activeOrder.road_address || "주소 미기재"}{" "}
                            {activeOrder.detail_address || ""}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 고객이 접수 시 업로드한 사전 사진 */}
                {parsedClientPhotos.length > 0 && (
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <p className="mb-2 text-xs font-semibold text-slate-400">
                      의뢰인 접수 시 첨부한 모재 사진 ({parsedClientPhotos.length}
                      장)
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {parsedClientPhotos.map((u, i) => (
                        <a
                          key={i}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative h-20 w-28 overflow-hidden rounded-xl border border-slate-700 bg-slate-950"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt={`사전 모재 사진 ${i + 1}`}
                            className="h-full w-full object-cover transition group-hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* [D] 1사이클 4단계 공식 공정 기록 & R2 사진/영상 뷰어 */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3.5">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-extrabold text-white">
                      단계별 공식 정련 검수 기록 & 현장 사진·영상 (1사이클 4단계)
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    각 단계가 종료될 때마다 계량 수치와 R2 증빙 영상·사진이
                    업데이트됩니다
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {stepDefinitions.map((stepDef) => {
                    const stepLog = activeLogs.find(
                      (l) => Number(l.step_number) === stepDef.num
                    );
                    const currentStep = Number(activeOrder.current_step ?? 0);
                    const isCompleted =
                      Boolean(stepLog) || currentStep >= stepDef.num;
                    const isNextUp =
                      !isCompleted && stepDef.num === currentStep + 1;
                    const mediaUrls = parseMediaUrls(stepLog?.photo_url);

                    return (
                      <div
                        key={stepDef.num}
                        className={`relative rounded-2xl border p-4 transition sm:p-5 ${
                          isCompleted
                            ? "border-emerald-500/40 bg-slate-950/90 shadow-md"
                            : isNextUp
                              ? "border-amber-400/50 bg-amber-500/5"
                              : "border-slate-800/80 bg-slate-950/40 opacity-60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            {isCompleted ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                              </span>
                            ) : isNextUp ? (
                              <span className="relative flex h-3 w-3">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
                              </span>
                            ) : (
                              <Clock className="h-4 w-4 text-slate-600" />
                            )}
                            <span
                              className={`text-sm font-extrabold ${
                                isCompleted
                                  ? "text-white"
                                  : isNextUp
                                    ? "text-amber-300"
                                    : "text-slate-400"
                              }`}
                            >
                              {stepDef.title}
                            </span>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              isCompleted
                                ? "bg-emerald-500/20 text-emerald-300"
                                : isNextUp
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {isCompleted
                              ? `완료 (${stepLog?.created_at || "기록됨"})`
                              : isNextUp
                                ? "현재 진행/대기 단계"
                                : "대기중"}
                          </span>
                        </div>

                        {stepLog ? (
                          <div className="mt-3 pl-1 sm:pl-8">
                            <div className="text-xs font-bold text-amber-300">
                              {stepLog.log_title}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-300">
                              {stepLog.log_detail}
                            </p>

                            {stepLog.measured_value && (
                              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                                <Scale className="h-3.5 w-3.5 text-emerald-400" />
                                <span>{stepLog.measured_value}</span>
                              </div>
                            )}

                            {/* Cloudflare R2에 저장된 단계별 사진/영상 표시 */}
                            {mediaUrls.length > 0 && (
                              <div className="mt-3 border-t border-slate-800/80 pt-3">
                                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
                                  {mediaUrls.some(isVideoUrl) ? (
                                    <Video className="h-3.5 w-3.5" />
                                  ) : (
                                    <ImageIcon className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    정련실 현장 증빙 영상·사진 ({mediaUrls.length}
                                    건 · 클릭 시 확대/재생)
                                  </span>
                                </p>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  {mediaUrls.map((mUrl, mIdx) =>
                                    isVideoUrl(mUrl) ? (
                                      <div
                                        key={mIdx}
                                        className="overflow-hidden rounded-xl border border-cyan-500/40 bg-black"
                                      >
                                        <video
                                          src={mUrl}
                                          controls
                                          playsInline
                                          preload="metadata"
                                          className="max-h-56 w-full object-contain"
                                        />
                                      </div>
                                    ) : (
                                      <a
                                        key={mIdx}
                                        href={mUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative block h-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={mUrl}
                                          alt={`STEP ${stepDef.num} 현장 사진 ${mIdx + 1}`}
                                          className="h-full w-full object-cover transition group-hover:scale-105"
                                        />
                                      </a>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mt-2 pl-1 text-xs text-slate-500 sm:pl-8">
                            {stepDef.desc}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
