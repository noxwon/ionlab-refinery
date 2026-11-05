"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ShieldCheck,
  Sparkles,
  Clock,
  Scale,
  Cpu,
  Layers,
  Ban,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Upload,
  X,
  Phone,
  Building2,
  FileText,
  ExternalLink,
  FlaskConical,
  Flame,
  Coins,
  BadgeCheck,
  ChevronRight,
  Info,
  Camera,
  Lock,
  RefreshCw,
  Mail,
  Search,
  Award,
  Settings,
} from "lucide-react";
import {
  TrackType,
  PreprocessOption,
  SettlementType,
  DeliveryMethod,
  TaxOptionType,
  KOREAN_BANKS,
  UploadedPhoto,
  OrderSubmissionPayload,
  formatKRW,
  calculateRefiningEstimate,
  calculateTaxBreakdown,
} from "@/lib/refining-calc";
import ClientTrackerView from "@/components/ClientTrackerView";
import ReceiptModal from "@/components/ReceiptModal";
import AdminDashboardView from "@/components/AdminDashboardView";
import { SEO_FAQ_ITEMS } from "@/lib/seo-data";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    daum?: any;
  }
}

export default function IonlabRefineryPage() {
  // ---------------------------------------------------------------------------
  // 1. 시뮬레이터 상태 (Section 5) - 그램(g) 단위 & 0.1g 단위 부드러운 슬라이더
  // ---------------------------------------------------------------------------
  const [simTrack, setSimTrack] = useState<TrackType>("plating");
  const [simWeightGrams, setSimWeightGrams] = useState<number>(2000); // 1,000g ~ 5,000g (1g 단위)
  const [simNeedsPreprocess, setSimNeedsPreprocess] = useState<boolean>(false);
  const [simExpectedGold, setSimExpectedGold] = useState<number>(8.0); // 1.0g ~ 30.0g (0.1g 단위)
  const [simGoldPrice, setSimGoldPrice] = useState<number>(171020);
  const [krxMeta, setKrxMeta] = useState<{
    source: string;
    basDd: string;
    changePrice?: number;
    flucRt?: string;
    loading: boolean;
  }>({
    source: "DEFAULT",
    basDd: "",
    loading: true,
  });

  // ---------------------------------------------------------------------------
  // 2. 온라인 작업 접수 폼 상태 (Section 7)
  // ---------------------------------------------------------------------------
  const [clientName, setClientName] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [returningInfo, setReturningInfo] = useState<{
    isReturningCustomer: boolean;
    orderCount: number;
    confirmedGoldGrams: number;
    totalGoldGrams: number;
    lastClientName?: string;
  } | null>(null);

  const [formTrack, setFormTrack] = useState<TrackType>("plating");
  const [formWeightGrams, setFormWeightGrams] = useState<number>(2000);
  const [formPreprocess, setFormPreprocess] =
    useState<PreprocessOption>("none");
  const [settlementType, setSettlementType] =
    useState<SettlementType>("physical_gold");

  // 순금 실물 수령 시: 택배(카카오 우편번호 서비스) 또는 방문 수령 상태
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("courier");
  const [zonecode, setZonecode] = useState<string>("");
  const [roadAddress, setRoadAddress] = useState<string>("");
  const [detailAddress, setDetailAddress] = useState<string>("");

  // 현금 정산 선택 시: 입금계좌 + 예금주 명의 일치 확인 + 법인 출금 세법/세금공제 상태
  const [bankName, setBankName] = useState<string>("KB국민은행");
  const [bankAccount, setBankAccount] = useState<string>("");
  const [accountHolder, setAccountHolder] = useState<string>("");
  const [accountHolderTouched, setAccountHolderTouched] =
    useState<boolean>(false);
  const [agreedAccountMatch, setAgreedAccountMatch] = useState<boolean>(false);
  const [taxOption, setTaxOption] = useState<TaxOptionType>(
    "personal_withholding_33"
  );
  const [businessNumber, setBusinessNumber] = useState<string>("");
  const [residentBirthPrefix, setResidentBirthPrefix] = useState<string>("");
  const [idCardDeliveryMethod, setIdCardDeliveryMethod] = useState<
    "upload_now" | "send_before_payout"
  >("send_before_payout");
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [agreedTaxPolicy, setAgreedTaxPolicy] = useState<boolean>(false);

  const [memo, setMemo] = useState<string>("");
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // 모달 상태 (접수 영수증 / 의뢰인 로그 조회 / 관리자 대시보드)
  const [receiptData, setReceiptData] =
    useState<OrderSubmissionPayload | null>(null);
  const [trackerOpen, setTrackerOpen] = useState<boolean>(false);
  const [adminOpen, setAdminOpen] = useState<boolean>(false);
  const [trackerInitial, setTrackerInitial] = useState<{
    email: string;
    phone: string;
    password: string;
  }>({ email: "", phone: "", password: "" });

  const orderFormRef = useRef<HTMLElement | null>(null);
  const simulatorRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const detailAddressRef = useRef<HTMLInputElement | null>(null);

  // 의뢰인 성함 입력 시 예금주명을 아직 직접 수정하지 않았다면 자동 동기화
  useEffect(() => {
    if (!accountHolderTouched) {
      setAccountHolder(clientName);
    }
  }, [clientName, accountHolderTouched]);

  // 카카오 우편번호 서비스(postcode.v2.js) 스크립트 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    const scriptId = "kakao-daum-postcode-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src =
        "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleOpenKakaoPostcode = () => {
    if (typeof window === "undefined") return;
    const openModal = () => {
      if (window.daum && window.daum.Postcode) {
        new window.daum.Postcode({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oncomplete: (data: any) => {
            const addr =
              data.userSelectedType === "R"
                ? data.roadAddress
                : data.jibunAddress;
            let extra = "";
            if (data.userSelectedType === "R") {
              if (data.bname !== "" && /[동|로|가]$/g.test(data.bname)) {
                extra += data.bname;
              }
              if (data.buildingName !== "" && data.apartment === "Y") {
                extra +=
                  extra !== "" ? `, ${data.buildingName}` : data.buildingName;
              }
              if (extra !== "") {
                extra = ` (${extra})`;
              }
            }
            setZonecode(data.zonecode || "");
            setRoadAddress(`${addr}${extra}`);
            setTimeout(() => {
              detailAddressRef.current?.focus();
            }, 100);
          },
        }).open();
      }
    };

    if (window.daum && window.daum.Postcode) {
      openModal();
    } else {
      const script = document.createElement("script");
      script.src =
        "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
      script.onload = () => openModal();
      document.body.appendChild(script);
    }
  };

  // KRX 실시간 금 시세 연동
  const fetchLiveGoldPrice = async () => {
    setKrxMeta((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/gold-price", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.pricePerGram && Number(data.pricePerGram) > 50000) {
          setSimGoldPrice(Number(data.pricePerGram));
          setKrxMeta({
            source: data.source || "KRX_OPEN_API",
            basDd: data.baseDate || data.basDd || "",
            changePrice: data.change ?? data.changePrice,
            flucRt:
              data.changeRate !== undefined
                ? String(data.changeRate)
                : data.flucRt,
            loading: false,
          });
          return;
        }
      }
    } catch {
      // fallback 유지
    }
    setKrxMeta((prev) => ({ ...prev, loading: false }));
  };

  useEffect(() => {
    fetchLiveGoldPrice();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "tracker") {
        setTrackerInitial({
          email: params.get("email") || "",
          phone: params.get("phone") || "",
          password: params.get("pw") || "",
        });
        setTrackerOpen(true);
      } else if (params.get("view") === "admin") {
        setAdminOpen(true);
      }
    }
  }, []);

  // 이메일 + 전화번호 입력 시 기존 고객 여부 및 누적 금 추출량 자동 확인
  useEffect(() => {
    const cleanEmail = clientEmail.trim();
    const cleanPhone = clientPhone.replace(/\D/g, "");
    if (!cleanEmail.includes("@") || cleanPhone.length < 9) {
      setReturningInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/customer-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, phone: clientPhone }),
        });
        const data = await res.json();
        if (data?.isReturningCustomer) {
          setReturningInfo(data);
          if (!clientName.trim() && data.lastClientName) {
            setClientName(data.lastClientName);
          }
        } else {
          setReturningInfo(null);
        }
      } catch {
        setReturningInfo(null);
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientEmail, clientPhone]);

  // 실시간 시뮬레이션 계산 (그램 단위 중량 반영)
  const simResult = useMemo(
    () =>
      calculateRefiningEstimate(
        simTrack,
        simWeightGrams,
        simNeedsPreprocess,
        simExpectedGold,
        simGoldPrice
      ),
    [simTrack, simWeightGrams, simNeedsPreprocess, simExpectedGold, simGoldPrice]
  );

  // 하단 폼의 예상 작업비 계산
  const formEstimate = useMemo(() => {
    const needsPre =
      (formTrack === "plating" && formPreprocess === "solder_removal") ||
      (formTrack === "ic" && formPreprocess === "heatspreader_removal");
    return calculateRefiningEstimate(
      formTrack,
      formWeightGrams,
      needsPre,
      simExpectedGold,
      simGoldPrice
    );
  }, [
    formTrack,
    formWeightGrams,
    formPreprocess,
    simExpectedGold,
    simGoldPrice,
  ]);

  // 현금 정산 선택 시 정련소 매입가(KRX 97.5%) 기준 세법 공제 및 세후 실송금액 계산 (선입금 작업비 이중차감 배제)
  const formTaxBreakdown = useMemo(
    () => calculateTaxBreakdown(formEstimate.cashGoldValue, taxOption),
    [formEstimate.cashGoldValue, taxOption]
  );

  // 의뢰인 성함/업체명과 입금계좌 예금주 명의 일치 여부 실시간 검증
  const isAccountHolderMatched = useMemo(() => {
    const cName = clientName.trim().replace(/\s+/g, "");
    const aHolder = accountHolder.trim().replace(/\s+/g, "");
    if (!cName || !aHolder) return false;
    return cName === aHolder;
  }, [clientName, accountHolder]);

  // 슬라이더 진행률 퍼센트 (부드러운 트랙 그라데이션용)
  const weightProgressPct = useMemo(
    () => ((simWeightGrams - 1000) / (5000 - 1000)) * 100,
    [simWeightGrams]
  );
  const goldProgressPct = useMemo(
    () => ((simExpectedGold - 1) / (30 - 1)) * 100,
    [simExpectedGold]
  );

  const handleTrackSwitch = (nextTrack: TrackType) => {
    setSimTrack(nextTrack);
    setSimNeedsPreprocess(false);
  };

  const applySimToOrderForm = () => {
    setFormTrack(simTrack);
    setFormWeightGrams(simWeightGrams);
    if (!simNeedsPreprocess) {
      setFormPreprocess("none");
    } else {
      setFormPreprocess(
        simTrack === "plating" ? "solder_removal" : "heatspreader_removal"
      );
    }
    orderFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToOrderForm = () => {
    orderFormRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToSimulator = () => {
    simulatorRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = 3 - uploadedPhotos.length;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    const newPhotos: UploadedPhoto[] = selectedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      sizeLabel: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    }));
    setUploadedPhotos((prev) => [...prev, ...newPhotos].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = (id: string) => {
    setUploadedPhotos((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!clientName.trim()) {
      setFormError("의뢰인 성함 또는 업체명을 입력해 주세요.");
      return;
    }
    if (!clientPhone.trim()) {
      setFormError("연락처(휴대폰 번호)를 입력해 주세요.");
      return;
    }
    if (!clientEmail.trim() || !clientEmail.includes("@")) {
      setFormError(
        "작업 로그 조회용 비밀번호를 수신할 정확한 이메일 주소를 입력해 주세요."
      );
      return;
    }

    // 1) 순금 실물 수령 + 택배 수령 선택 시 카카오 우편번호 주소 필수 검증
    if (settlementType === "physical_gold" && deliveryMethod === "courier") {
      if (!zonecode.trim() || !roadAddress.trim()) {
        setFormError(
          "순금 실물 택배 수령을 위해 [우편번호 검색] 버튼을 눌러 수령 주소를 입력해 주세요."
        );
        return;
      }
      if (!detailAddress.trim()) {
        setFormError("순금 안심소포 수령을 위한 상세주소(동·호수·층)를 입력해 주세요.");
        return;
      }
    }

    // 2) 현금 정산 선택 시 계좌번호 + 의뢰인=예금주 일치 + 법인 출금 세법 공제 동의 필수 검증
    if (settlementType === "cash_transfer") {
      if (!bankName.trim() || !bankAccount.trim()) {
        setFormError("현금 정산을 받으실 입금 은행과 계좌번호를 입력해 주세요.");
        return;
      }
      if (!accountHolder.trim()) {
        setFormError("입금 계좌의 예금주 성함(또는 법인명)을 입력해 주세요.");
        return;
      }
      if (!isAccountHolderMatched) {
        setFormError(
          `의뢰인 성함(${clientName.trim()})과 입금계좌 예금주(${accountHolder.trim()})가 일치하지 않습니다. 금융사고 방지 및 법인 출금 규정상 반드시 동일 명의 계좌를 입력해 주세요.`
        );
        return;
      }
      if (!agreedAccountMatch) {
        setFormError(
          "의뢰인 성함과 입금계좌 예금주 명의가 동일함을 확인하는 체크박스에 동의해 주세요."
        );
        return;
      }
      if (taxOption === "business_invoice" && !businessNumber.trim()) {
        setFormError(
          "사업자 세금계산서 정산 선택 시 사업자등록번호를 입력해 주세요."
        );
        return;
      }
      if (
        taxOption !== "business_invoice" &&
        idCardDeliveryMethod === "upload_now" &&
        !idCardFile
      ) {
        setFormError(
          "세무사 원천징수 신고용 신분증 사본 '지금 첨부'를 선택하셨습니다. 신분증 이미지를 선택하시거나 '정산 송금 전 별도 제출'로 변경해 주세요."
        );
        return;
      }
      if (!agreedTaxPolicy) {
        setFormError(
          "법인 출금에 따른 세법 적용 및 세금공제(또는 적격 증빙 확인) 후 송금 방식에 동의해 주세요."
        );
        return;
      }
    }

    if (!agreedTerms) {
      setFormError("위탁 정련 필수 안내사항 동의에 체크해 주세요.");
      return;
    }

    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      "0"
    )}${String(now.getDate()).padStart(2, "0")}`;
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const receiptNumber = `ION-${ymd}-${randCode}`;
    const submittedAt = now.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const submissionPayload: OrderSubmissionPayload = {
      receiptNumber,
      submittedAt,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      track: formTrack,
      weight: formEstimate.weight,
      weightGrams: formEstimate.weightGrams,
      preprocessOption: formPreprocess,
      settlementType,
      deliveryMethod:
        settlementType === "physical_gold" ? deliveryMethod : undefined,
      zonecode: settlementType === "physical_gold" ? zonecode.trim() : "",
      roadAddress: settlementType === "physical_gold" ? roadAddress.trim() : "",
      detailAddress:
        settlementType === "physical_gold" ? detailAddress.trim() : "",
      bankName: settlementType === "cash_transfer" ? bankName.trim() : "",
      bankAccount: settlementType === "cash_transfer" ? bankAccount.trim() : "",
      accountHolder:
        settlementType === "cash_transfer" ? accountHolder.trim() : "",
      isAccountHolderMatched:
        settlementType === "cash_transfer" ? isAccountHolderMatched : undefined,
      taxOption: settlementType === "cash_transfer" ? taxOption : undefined,
      taxOptionLabel:
        settlementType === "cash_transfer"
          ? formTaxBreakdown.taxOptionLabel
          : "",
      businessNumber:
        settlementType === "cash_transfer" ? businessNumber.trim() : "",
      residentBirthPrefix:
        settlementType === "cash_transfer" && taxOption !== "business_invoice"
          ? residentBirthPrefix.trim()
          : "",
      idCardDeliveryMethod:
        settlementType === "cash_transfer" && taxOption !== "business_invoice"
          ? idCardFile
            ? "upload_now"
            : idCardDeliveryMethod
          : undefined,
      withholdingTaxAmount:
        settlementType === "cash_transfer"
          ? formTaxBreakdown.withholdingTaxAmount
          : 0,
      finalCashPayout:
        settlementType === "cash_transfer"
          ? formTaxBreakdown.finalCashPayout
          : formEstimate.netClientProfit,
      expectedGold: formEstimate.expectedGold,
      goldPrice: formEstimate.goldPrice,
      memo: memo.trim(),
      photoNames:
        uploadedPhotos.length > 0
          ? uploadedPhotos.map((p) => p.name)
          : ["현장 사진 미첨부 (상담 시 전달 예정)"],
      estimate: formEstimate,
    };

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify(submissionPayload));

      uploadedPhotos.forEach((photo) => {
        formData.append("photos", photo.file);
      });

      if (
        settlementType === "cash_transfer" &&
        taxOption !== "business_invoice" &&
        idCardFile
      ) {
        formData.append("idCardFile", idCardFile);
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      setReceiptData({
        ...submissionPayload,
        accessPassword: result?.accessPassword,
        isReturningCustomer: result?.isReturningCustomer,
        previousOrderCount: result?.previousOrderCount,
        cumulativeGoldGrams: result?.cumulativeGoldGrams,
        uploadedPhotoUrls: result?.photoUrls || [],
      });
    } catch {
      setReceiptData(submissionPayload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A11] pb-20 text-slate-100 selection:bg-amber-500 selection:text-slate-950 sm:pb-0">
      {/* =====================================================================
          Section 1. GNB (상단 고정 글래스모피즘 바)
      ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070A11]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-6 lg:px-8">
          {/* 좌측 로고 */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/25 to-amber-600/5 shadow-lg shadow-amber-500/10">
              <FlaskConical className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white sm:text-lg">
                  IONLAB{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                    REFINERY
                  </span>
                </span>
                <span className="hidden rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 sm:inline-block">
                  PRECISION LAB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 sm:text-xs">
                소규모 정밀 습식 금 추출 센터
              </p>
            </div>
          </div>

          {/* 중앙 라이브 배지: 펄스닷만 유지 + 합법시설 + KRX 실시간 금시세 */}
          <div className="order-3 flex w-full items-center justify-center lg:order-2 lg:w-auto">
            <div className="inline-flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 px-3.5 py-1.5 text-xs font-medium text-slate-200 shadow-inner sm:w-auto sm:rounded-full">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-bold text-emerald-300">합법시설</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300">
                KRX 금 시세:{" "}
                <strong className="font-extrabold text-amber-400">
                  ₩{formatKRW(simGoldPrice)} / g
                </strong>{" "}
                <span className="hidden text-[11px] text-slate-400 sm:inline">
                  (
                  {krxMeta.loading
                    ? "KRX 실시간 조회중..."
                    : krxMeta.source === "KRX_OPEN_API"
                      ? `기준일 ${krxMeta.basDd}${
                          krxMeta.flucRt ? ` · ${krxMeta.flucRt}%` : ""
                        }`
                      : "KRX 실시간 연동"}
                  )
                </span>
              </span>
              <button
                type="button"
                onClick={fetchLiveGoldPrice}
                title="KRX 금시세 새로고침"
                className="inline-flex items-center rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-300"
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    krxMeta.loading ? "animate-spin text-amber-400" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 우측 버튼 */}
          <div className="order-2 flex items-center gap-2 lg:order-3">
            <button
              type="button"
              onClick={() => {
                setTrackerInitial({ email: "", phone: "", password: "" });
                setTrackerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
            >
              <Search className="h-3.5 w-3.5" />
              <span>작업 로그 · 누적량 조회</span>
            </button>
            <a
              href="https://scan.techplay.blog"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-500/20 md:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI 사전판독</span>
              <ExternalLink className="h-3 w-3 opacity-75" />
            </a>
            <button
              type="button"
              onClick={scrollToOrderForm}
              className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 shadow-md shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 sm:inline-flex"
            >
              <span>작업 접수하기</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
      {/* =====================================================================
          Section 2. Hero Section (핵심 가치 제안 & 모던 Bento Grid)
      ===================================================================== */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-b from-[#070A11] via-[#0D1322] to-[#070A11] py-12 sm:py-20">
        <div className="pointer-events-none absolute -top-28 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute top-28 right-8 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 shadow-sm sm:text-sm">
              <BadgeCheck className="h-4 w-4 text-amber-400" />
              <span>특허출원 제10-2026-0182129호 기반 정밀 습식 정련</span>
            </div>

            <h1 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              1kg 소량 모재부터 1인 1배치 단독 정련,
              <span className="mt-2 block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                투명한 데이터로 고순도 순금을 회수합니다.
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              정찰제 공임과 단계별 실측 영상·사진 로그 공개로 의뢰인의 정당한
              수율을 보장합니다.
              <span className="mt-1 block text-xs text-slate-400">
                (표준 98.5~99.5% 골드 비드 추출 · 99.9% 고순도 정제는 별도 상담)
              </span>
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToSimulator}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/25 transition hover:scale-[1.01] hover:from-amber-300 hover:to-amber-400 sm:w-auto sm:text-base"
              >
                <Calculator className="h-5 w-5" />
                <span>그램(g) 단위 정밀 수익 계산해보기</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrackerInitial({ email: "", phone: "", password: "" });
                  setTrackerOpen(true);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-sm font-bold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20 sm:w-auto sm:text-base"
              >
                <Search className="h-4 w-4 text-emerald-400" />
                <span>내 작업 로그 · 누적 금 추출량 조회</span>
              </button>
            </div>
          </div>

          {/* 3대 핵심 신뢰 지표 Bento 카드 */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
            <div className="group rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-md transition hover:border-amber-500/40">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                최소 1kg (1,000g)부터 작업 가능
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                대형 제련소에서 거절하는 1kg~5kg 소량 고품위 모재도 타 물량과
                섞이지 않는 1인 1배치(Batch) 단독 공정으로 정밀 추출합니다.
              </p>
            </div>

            <div className="group rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-md transition hover:border-cyan-500/40">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                금도금 1일 · IC칩 2일 초고속 정산
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                금도금 모재는{" "}
                <strong className="text-cyan-300">
                  당일 오전 11시까지 접수/입고분에 한해 당일 1일 완성
                </strong>
                (이후 접수분 익일), IC/BGA 칩은 48시간 내 완료됩니다.
              </p>
            </div>

            <div className="group rounded-3xl border border-white/10 bg-slate-900/70 p-6 backdrop-blur-md transition hover:border-emerald-500/40">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <Award className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">
                고객별 누적 추출 이력 평생 관리
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                첫 의뢰 시 등록한 이메일·전화번호로 재주문 시 과거 주문 내역과{" "}
                <strong className="text-emerald-300">누적 금 추출량(g)</strong>을
                한눈에 확인하실 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 3. 작업 가능 품목 & 입고 기준 (Gatekeeping Section)
      ===================================================================== */}
      <section className="border-b border-white/10 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-extrabold tracking-wider text-cyan-400 uppercase">
              GATEKEEPING & MATERIAL POLICY
            </span>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              작업 가능 품목 및 입고 기준 안내
            </h2>
            <p className="mt-3 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
              이온랩은 공정 효율과 빠른 정산을 위해{" "}
              <strong className="font-bold text-amber-400">
                즉시 약품 투입이 가능한 탈거/분리 모재
              </strong>
              만 취급합니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Track 1 */}
            <div className="flex flex-col justify-between rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    🟢 Track 1 · 1일 공정 (오전 11시 접수분 당일 완성)
                  </span>
                  <Layers className="h-5 w-5 text-emerald-400" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold text-white">
                  금도금 모재 (Plating Base)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  순수 금도금 핀, 커넥터 단자, 절단된 골드핑거(RAM 슬롯 등),
                  금도금 FPCB (플라스틱/철편 제거 상태)
                </p>
                <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="text-emerald-200">
                      <strong>당일 오전 11시까지 입고/접수분</strong>에 한해 당일
                      1일 완성 (이후 접수분은 익일 완료)
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>주석/납 땜 부착 모재는 전처리 옵션으로 완벽 분리</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 rounded-xl bg-slate-950/80 px-3.5 py-2.5 text-xs text-emerald-300">
                ✓ 입고 적합 상태: 플라스틱 사출물 없이 도금 금속부만 분리된 상태
              </div>
            </div>

            {/* Track 2 */}
            <div className="flex flex-col justify-between rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-slate-900/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold text-cyan-300">
                    🔵 Track 2 · 2일 공정 (48시간 특수 정련)
                  </span>
                  <Cpu className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold text-white">
                  IC / BGA 칩 모재 (Chip Package)
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  기판에서 탈거된 순수 IC, BGA, QFP, 메모리 칩 단품 (에폭시 해체
                  및 실리카 미세 여과 48시간 공정)
                </p>
                <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-400">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span>
                      고온 탄화/화학적 에폭시 해체 후 본딩 와이어 전량 회수
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-400" />
                    <span>실리카 슬러지 다중 감압 여과로 미립 금 손실 제로화</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 rounded-xl bg-slate-950/80 px-3.5 py-2.5 text-xs text-cyan-300">
                ✓ 입고 적합 상태: PCB 기판에서 열풍/기계 탈거된 칩 단품 상태
              </div>
            </div>

            {/* 입고 불가 */}
            <div className="flex flex-col justify-between rounded-3xl border border-rose-500/30 bg-gradient-to-b from-rose-950/20 to-slate-900/90 p-6">
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-bold text-rose-300">
                    🔴 입고 불가 (사전 해체 필요)
                  </span>
                  <Ban className="h-5 w-5 text-rose-400" />
                </div>
                <h3 className="mt-4 text-xl font-extrabold text-white">
                  미분류 통기판 · 비금속 혼입물
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  해체되지 않은 통기판(PCB), 플라스틱 하우징 뭉치, 알루미늄/구리선
                  똥칩
                </p>
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-950/30 p-3.5 text-xs leading-relaxed text-rose-200">
                  ※ 작업 전 <strong>무료 비전 AI 스캔</strong>으로 금 본딩 와이어
                  함유 여부와 예상 품위를 먼저 판별해 드립니다.
                </div>
              </div>
              <a
                href="https://scan.techplay.blog"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-between rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/20"
              >
                <span>무료 비전 AI 사전 판독 바로가기</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 4. 투트랙(Two-Track) 표준 요금표 (99.9% 유료옵션 제거, 별도상담 안내)
      ===================================================================== */}
      <section
        id="pricing"
        aria-label="표준 정련 요금표"
        className="border-b border-white/10 bg-[#0B101C]/70 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-extrabold tracking-wider text-amber-400 uppercase">
              TRANSPARENT TWO-TRACK PRICING
            </span>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              투트랙(Two-Track) 표준 정련 요금표
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              의뢰인이 100% 납득할 수 있도록{" "}
              <span className="font-semibold text-slate-200">
                [기본 기술료 + 일일 인건비 + 약품·폐수 실비]
              </span>{" "}
              원가 구성을 투명하게 공개합니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Track 1 요금 카드 */}
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/90 p-6 shadow-xl sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-5">
                <div>
                  <span className="text-xs font-extrabold text-emerald-400">
                    TRACK 1 · GOLD PLATING
                  </span>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    금도금 모재 (1일 완성)
                  </h3>
                </div>
                <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-extrabold text-emerald-300">
                  당일 오전 11시까지 접수분에 한함
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      기본 1kg (1,000g) 요금
                    </span>
                    <span className="text-2xl font-black text-amber-400">
                      130,000원
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    기술료 5만 + 1일 인건비 6만 + 약품·폐수 실비 2만
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-emerald-200">
                      추가 중량 (1kg 초과 ~ 5kg 구간 · g단위 비례)
                    </span>
                    <span className="text-xl font-black text-emerald-300">
                      +30,000원 / kg
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-300/80">
                    공임 할증 1만 + 실비 2만 (그램 단위로 정밀 비례 계산 →{" "}
                    <strong className="underline">
                      5kg 의뢰 시 kg당 5.0만원으로 대폭 하락!
                    </strong>
                    )
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      선택 전처리 옵션
                    </span>
                    <span className="text-sm font-bold text-amber-300">
                      +15,000원 / kg
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    납(주석 땜) 제거 공정 필요 시 선택 (g단위 비례 적용)
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    <span>고수율 연동 기준 (10g 이상 추출 시)</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-sans font-bold text-amber-300">
                      [기본 작업비]
                    </span>
                    와{" "}
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-sans font-bold text-amber-300">
                      [추출 순금 가치의 10% + 약품 실비]
                    </span>{" "}
                    중 큰 금액(Max) 적용
                  </p>
                </div>
              </div>
            </div>

            {/* Track 2 요금 카드 */}
            <div className="rounded-3xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-5">
                <div>
                  <span className="text-xs font-extrabold text-cyan-400">
                    TRACK 2 · IC / BGA PACKAGE
                  </span>
                  <h3 className="mt-1 text-2xl font-black text-white">
                    IC / BGA 칩 모재 (2일 완성)
                  </h3>
                </div>
                <span className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-extrabold text-cyan-300">
                  48시간 정밀 공정
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      기본 1kg (1,000g) 요금
                    </span>
                    <span className="text-2xl font-black text-amber-400">
                      230,000원
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    특수기술료 7만 + 2일 인건비 12만 + 탄화·약품 실비 4만
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-cyan-200">
                      추가 중량 (1kg 초과 ~ 5kg 구간 · g단위 비례)
                    </span>
                    <span className="text-xl font-black text-cyan-300">
                      +60,000원 / kg
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-cyan-300/80">
                    미분쇄·다중여과 공임 3만 + 실비 3만 (그램 단위로 정밀 비례 계산
                    →{" "}
                    <strong className="underline">
                      5kg 의뢰 시 kg당 9.4만원으로 절감!
                    </strong>
                    )
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-300">
                      선택 전처리 옵션
                    </span>
                    <span className="text-sm font-bold text-amber-300">
                      +25,000원 / kg
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    방열판(구리 히트스프레더 뚜껑) 부착 칩 해체 필요 시 선택
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                    <Sparkles className="h-4 w-4" />
                    <span>고수율 연동 기준 (15g 이상 추출 시)</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-sans font-bold text-amber-300">
                      [기본 작업비]
                    </span>
                    와{" "}
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-sans font-bold text-amber-300">
                      [추출 순금 가치의 12% + 약품 실비]
                    </span>{" "}
                    중 큰 금액(Max) 적용
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 99.9% 별도 상담 안내 배너 */}
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 text-center text-xs text-amber-200 sm:text-sm">
            💡 <strong>순도 안내:</strong> 모든 기본 공정은 비용 대비 수율 효율이
            가장 뛰어난 <strong>1차 정련 골드 비드(순도 98.5% ~ 99.5%)</strong>로
            추출되며, <strong>99.9% 초고순도 정제</strong>가 필요한 경우 별도 사전
            상담 후 맞춤 진행해 드립니다.
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 5. ⚡ 인터랙티브 견적 & 기대수익 시뮬레이터 (그램 단위 부드러운 슬라이더)
      ===================================================================== */}
      <section
        ref={simulatorRef}
        id="simulator"
        className="border-b border-white/10 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-extrabold text-amber-300">
              ⚡ GRAM-PRECISION PROFIT SIMULATOR
            </span>
            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              인터랙티브 견적 & 기대수익 시뮬레이터
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              모재 중량을 <strong>그램(g) 단위</strong>로, 예상 금 추출량을{" "}
              <strong>0.1g 단위</strong>로 부드럽게 슬라이드하여 정확한 작업 비용과
              순수익을 확인하세요.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* 좌측 컨트롤 패널 */}
            <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl sm:p-8 lg:col-span-7">
              {/* 1. 트랙 선택 */}
              <div>
                <label className="block text-xs font-extrabold tracking-wider text-slate-400 uppercase">
                  1. 정련 트랙 선택
                </label>
                <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleTrackSwitch("plating")}
                    className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                      simTrack === "plating"
                        ? "border-amber-400 bg-amber-500/15 text-white shadow-lg shadow-amber-500/10"
                        : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-extrabold">
                        금도금 모재 (1일 완성)
                      </div>
                      <div className="mt-0.5 text-[11px] text-amber-300/90">
                        오전 11시까지 접수분 당일 완성
                      </div>
                      <div className="mt-0.5 text-xs opacity-80">
                        기본 13만 / 추가 +3만/kg
                      </div>
                    </div>
                    <Layers
                      className={`h-5 w-5 shrink-0 ${
                        simTrack === "plating"
                          ? "text-amber-400"
                          : "text-slate-500"
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTrackSwitch("ic")}
                    className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                      simTrack === "ic"
                        ? "border-cyan-400 bg-cyan-500/15 text-white shadow-lg shadow-cyan-500/10"
                        : "border-white/10 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-extrabold">
                        IC/BGA 칩 모재 (2일 완성)
                      </div>
                      <div className="mt-0.5 text-[11px] text-cyan-300/90">
                        에폭시 해체·다중여과 48시간
                      </div>
                      <div className="mt-0.5 text-xs opacity-80">
                        기본 23만 / 추가 +6만/kg
                      </div>
                    </div>
                    <Cpu
                      className={`h-5 w-5 shrink-0 ${
                        simTrack === "ic" ? "text-cyan-400" : "text-slate-500"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 2. 의뢰 중량 슬라이더 (1,000g ~ 5,000g, 1g 단위 부드러운 슬라이드) */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-extrabold tracking-wider text-slate-300 uppercase">
                      2. 의뢰 중량 (그램 단위 부드러운 정밀 조절)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      1,000g(1.00kg) ~ 5,000g(5.00kg) · 1g 단위 연속 슬라이드
                    </p>
                  </div>

                  {/* 직접 그램 입력 + 현재 kg/g 배지 */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1000}
                        max={5000}
                        step={10}
                        value={simWeightGrams}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) {
                            setSimWeightGrams(
                              Math.max(1000, Math.min(5000, Math.round(v)))
                            );
                          }
                        }}
                        className="w-28 rounded-xl border border-amber-500/40 bg-slate-900 px-3 py-1.5 pr-7 text-right font-mono text-sm font-black text-amber-300 focus:border-amber-400 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-bold text-amber-400">
                        g
                      </span>
                    </div>
                    <span className="rounded-xl bg-amber-500/20 px-3 py-1.5 font-mono text-sm font-black text-amber-300">
                      {(simWeightGrams / 1000).toFixed(2)} kg
                    </span>
                  </div>
                </div>

                {/* 부드러운 커스텀 슬라이더 */}
                <div className="mt-4 px-1">
                  <input
                    type="range"
                    min={1000}
                    max={5000}
                    step={1}
                    value={simWeightGrams}
                    onChange={(e) => setSimWeightGrams(Number(e.target.value))}
                    style={{
                      background: `linear-gradient(to right, #f59e0b 0%, #fbbf24 ${weightProgressPct}%, #1e293b ${weightProgressPct}%, #1e293b 100%)`,
                    }}
                    className="smooth-slider w-full cursor-pointer"
                  />
                </div>

                {/* 빠른 프리셋 및 미세 조절 버튼 (모바일 터치 최적화) */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[1000, 2000, 3000, 4000, 5000].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setSimWeightGrams(g)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          simWeightGrams === g
                            ? "bg-amber-400 text-slate-950"
                            : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {g / 1000}kg
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {[-100, -10, 10, 100].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() =>
                          setSimWeightGrams((prev) =>
                            Math.max(1000, Math.min(5000, prev + delta))
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-slate-300 transition hover:border-amber-400 hover:text-amber-300"
                      >
                        {delta > 0 ? `+${delta}g` : `${delta}g`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. 전처리 옵션 체크박스 */}
              <div>
                <label className="block text-xs font-extrabold tracking-wider text-slate-400 uppercase">
                  3. 선택 전처리 옵션
                </label>
                <label
                  className={`mt-2 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                    simNeedsPreprocess
                      ? "border-amber-400 bg-amber-500/15"
                      : "border-white/10 bg-slate-950/70 hover:border-amber-500/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={simNeedsPreprocess}
                    onChange={(e) => setSimNeedsPreprocess(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-100">
                      {simTrack === "plating"
                        ? "주석/납(땜) 제거 전처리 필요 (+15,000원/kg · g단위 비례)"
                        : "방열판(구리 뚜껑) 제거 필요 (+25,000원/kg · g단위 비례)"}
                    </div>
                    <div className="mt-0.5 text-slate-400">
                      불순물 사전 화학 분리 공정 (순수 탈거 모재는 체크 해제)
                    </div>
                  </div>
                </label>
              </div>

              {/* 4. 예상 금 추출량 슬라이더 (1.0g ~ 30.0g, 0.1g 단위 부드러운 스크롤) */}
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-extrabold tracking-wider text-slate-300 uppercase">
                      4. 예상 금 추출량 (0.1g 단위 부드러운 스크롤)
                    </label>
                    <p className="text-[11px] text-slate-400">
                      1.0g ~ 30.0g · 드래그 또는 미세 버튼으로 정밀 시뮬레이션
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        step={0.1}
                        value={simExpectedGold}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v)) {
                            setSimExpectedGold(
                              Math.max(
                                1,
                                Math.min(30, Number(v.toFixed(1)))
                              )
                            );
                          }
                        }}
                        className="w-24 rounded-xl border border-emerald-500/40 bg-slate-900 px-3 py-1.5 pr-7 text-right font-mono text-sm font-black text-emerald-300 focus:border-emerald-400 focus:outline-none"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-bold text-emerald-400">
                        g
                      </span>
                    </div>
                  </div>
                </div>

                {/* 부드러운 에메랄드 커스텀 슬라이더 */}
                <div className="mt-4 px-1">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={0.1}
                    value={simExpectedGold}
                    onChange={(e) =>
                      setSimExpectedGold(Number(Number(e.target.value).toFixed(1)))
                    }
                    style={{
                      background: `linear-gradient(to right, #10b981 0%, #34d399 ${goldProgressPct}%, #1e293b ${goldProgressPct}%, #1e293b 100%)`,
                    }}
                    className="smooth-slider emerald-slider w-full cursor-pointer"
                  />
                </div>

                {/* 빠른 프리셋 및 0.1g 미세 조절 버튼 */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 5, 10, 15, 20, 25].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSimExpectedGold(val)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          simExpectedGold === val
                            ? "bg-emerald-400 text-slate-950"
                            : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                        }`}
                      >
                        {val}g
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    {[-1, -0.1, 0.1, 1].map((delta) => (
                      <button
                        key={delta}
                        type="button"
                        onClick={() =>
                          setSimExpectedGold((prev) =>
                            Math.max(
                              1,
                              Math.min(30, Number((prev + delta).toFixed(1)))
                            )
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] font-bold text-slate-300 transition hover:border-emerald-400 hover:text-emerald-300"
                      >
                        {delta > 0 ? `+${delta}g` : `${delta}g`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-slate-900/90 p-2.5 text-xs text-slate-400">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                  <span>
                    참고 가이드: 절단 골드핑거 1kg당 약 <strong>2~4g</strong>,
                    고품위 도금핀/BGA 칩 1kg당 약 <strong>3~10g+</strong> 추출
                  </span>
                </div>
              </div>

              {/* 5. 금 시세 입력값 (KRX 연동 + 수정 가능) */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold tracking-wider text-slate-400 uppercase">
                    5. 적용 금 시세 (1g 기준 · KRX 실시간 연동 / 직접 수정 가능)
                  </label>
                  <button
                    type="button"
                    onClick={fetchLiveGoldPrice}
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    KRX 시세 다시 불러오기
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={50000}
                      max={500000}
                      step={100}
                      value={simGoldPrice}
                      onChange={(e) =>
                        setSimGoldPrice(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs text-slate-400">
                      원 / g
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 우측 실시간 계산 결과 */}
            <div className="flex flex-col justify-between rounded-3xl border border-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 shadow-2xl sm:p-8 lg:col-span-5">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="text-xs font-extrabold text-amber-400 uppercase">
                      ESTIMATED STATEMENT
                    </span>
                    <h3 className="text-lg font-black text-white">
                      실시간 정산 시뮬레이션 결과
                    </h3>
                  </div>
                  {simResult.isRatioApplied ? (
                    <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 text-xs font-extrabold text-amber-300">
                      고수율 비율제 적용
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
                      기본 정액제 적용
                    </span>
                  )}
                </div>

                {/* 산출 내역 */}
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between text-slate-300">
                    <span>선택 트랙</span>
                    <span className="font-bold text-white">
                      {simResult.trackName}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>정밀 의뢰 중량</span>
                    <span className="font-mono font-bold text-amber-300">
                      {simResult.weight.toFixed(2)} kg (
                      {simResult.weightGrams.toLocaleString()} g)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>정련 순도 기준</span>
                    <span className="text-xs font-semibold text-emerald-300">
                      표준 1차 정련 (98.5~99.5%)
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>기본 작업비 (A · g비례)</span>
                    <span>₩{formatKRW(simResult.baseCostA)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>전처리 비용 (B · g비례)</span>
                    <span>₩{formatKRW(simResult.preprocessCostB)}</span>
                  </div>

                  {simResult.isHighYieldThresholdMet && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                      • 고수율 구간({simResult.highYieldThresholdGrams}g 초과)
                      비율 산정액: ₩{formatKRW(simResult.ratioBasedCost)} (금
                      가치 {simResult.highYieldRatePercent}% + 약품실비 ₩
                      {formatKRW(simResult.chemicalCostC)} + 전처리 합산)
                    </div>
                  )}

                  <div className="border-t border-white/10 pt-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-200">
                        추출 금 총 가치 (V · {simResult.expectedGold.toFixed(1)}
                        g)
                      </span>
                      <span className="text-base font-extrabold text-white">
                        ₩{formatKRW(simResult.totalGoldValueV)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-slate-200">
                      최종 청구 작업비 (수수료)
                    </span>
                    <span className="text-lg font-extrabold text-rose-400">
                      - ₩{formatKRW(simResult.finalWorkFee)}
                    </span>
                  </div>
                </div>

                {/* 의뢰인 최종 순수익 박스 */}
                <div className="mt-6 rounded-2xl border border-amber-400/40 bg-slate-950/90 p-5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">
                      의뢰인 최종 예상 수령액 (추출 전 가상 시뮬레이션)
                    </span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                      추출 당일 시세로 최종 확정
                    </span>
                  </div>
                  <div
                    className={`mt-1.5 text-2xl font-black sm:text-3xl ${
                      simResult.netClientProfit >= 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    ₩{formatKRW(simResult.netClientProfit)}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    실물 순금 비드({simResult.expectedGold.toFixed(1)}g) 택배/방문 수령 또는 정련소 당일 매입가 기준 현금 계좌 정산 선택 가능
                  </p>
                  <p className="mt-1 text-[11px] text-amber-200/90 leading-relaxed">
                    ※ 현금 정산 시 실제 정산 송금액은 STEP 03 공정 완료일의 [정련소 순금비드 당일 매입 시세(KRX 공인 기준가의 97.5%)] 및 실제 추출 순금량으로 최종 확정 산출됩니다. (※ STEP 01에서 선입금하신 작업비는 이중 차감하지 않고 금 매입대금 전액을 송금해 드립니다.)
                  </p>
                </div>

                {simResult.netClientProfit < 0 && (
                  <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-950/40 p-3.5 text-xs leading-relaxed text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                    <div>
                      <strong>
                        ⚠️ 예상 수율 미달: 작업 시 손해가 발생할 수 있으니 무료
                        AI 사전 스캔을 먼저 권장합니다.
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={applySimToOrderForm}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400"
              >
                <span>
                  이 조건({(simWeightGrams / 1000).toFixed(2)}kg)으로 바로 작업
                  접수하기
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 6. 4단계 투명 공정 & 정산 프로세스
      ===================================================================== */}
      <section className="border-b border-white/10 bg-[#0B101C]/50 py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-xs font-extrabold tracking-wider text-emerald-400 uppercase">
              TRANSPARENT 4-STEP PROCESS
            </span>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              4단계 투명 공정 & 고객 누적 추출 관리
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              첫 의뢰 시 등록하신 이메일과 전화번호로{" "}
              <strong>과거 주문 이력과 누적 금 추출량(g)</strong>이 계속
              적립·관리됩니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-cyan-500/15 px-2.5 py-1 text-xs font-extrabold text-cyan-300">
                  STEP 01
                </span>
                <Camera className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">
                입금 확인 & 모재 실측 계량
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                온라인 접수 후 작업비 입금이 확인되고 택배/방문 입고된 모재를
                전자저울로 실측(g)하여 현장 사진·영상을 등록하면 1단계가
                완료됩니다.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-300">
                  STEP 02
                </span>
                <FlaskConical className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">
                단독 배치(Batch) 습식 정련
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                타 의뢰인의 물량과 절대 섞이지 않는 1인 1배치 독립 반응조
                운영으로 수율 혼선을 원천 차단합니다.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-300">
                  STEP 03
                </span>
                <Flame className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">
                순금 비드(Gold Button) 추출
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                고순도 1차 환원(98.5~99.5%) 후 고온 용융하여 골드 비드를
                성형하고 0.01g 단위 확정 추출량을 고객 누적 계정에 기록합니다.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-extrabold text-emerald-300">
                  STEP 04
                </span>
                <Coins className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-white">
                의뢰인 맞춤형 정산
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                추출된{" "}
                <strong className="text-amber-300">[순금 실물 택배 발송]</strong>{" "}
                또는{" "}
                <strong className="text-emerald-300">
                  [당일 시세 현금 매입 정산]
                </strong>{" "}
                중 자유롭게 선택하실 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Section 7. 📝 온라인 작업 접수 & 고객 자동 인식 폼
      ===================================================================== */}
      <section
        ref={orderFormRef}
        id="order-form"
        className="border-b border-white/10 py-14 sm:py-20"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-extrabold text-emerald-300">
              📝 ONLINE WORK ORDER & CUSTOMER TRACKING
            </span>
            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              온라인 위탁 정련 작업 접수
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              첫 의뢰 고객님은 이메일과 전화번호로 계정이 자동 생성되며, 재방문
              고객님은 기존 비밀번호로 전체 주문 내역과 누적 금 추출량이 통합
              관리됩니다.
            </p>
          </div>

          <form
            onSubmit={handleOrderSubmit}
            className="mt-10 space-y-6 rounded-3xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl sm:p-8"
          >
            {/* 1. 의뢰인 기본 정보 (이메일 + 연락처 + 성함) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-amber-300">
                  이메일 (고객 식별 · 비밀번호 수신){" "}
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-amber-400" />
                  <input
                    type="email"
                    placeholder="예: client@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full rounded-2xl border border-amber-500/40 bg-slate-950 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  연락처 (휴대폰 번호) <span className="text-rose-400">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Phone className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    placeholder="예: 010-1234-5678"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  의뢰인 성함 / 업체명 <span className="text-rose-400">*</span>
                </label>
                <div className="relative mt-1.5">
                  <Building2 className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="예: 홍길동 / 대성메탈"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 py-3 pr-4 pl-10 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 재방문 고객 자동 인식 알림 카드 */}
            {returningInfo?.isReturningCustomer && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 shrink-0 text-emerald-400" />
                  <span>
                    <strong>
                      반갑습니다, {returningInfo.lastClientName || clientName}
                      님!
                    </strong>{" "}
                    기존 <strong>{returningInfo.orderCount}회 의뢰 이력</strong>이
                    확인되었습니다. (기존 비밀번호가 그대로 유지됩니다)
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-extrabold text-emerald-300">
                  누적 금 추출량: {returningInfo.totalGoldGrams}g (확정{" "}
                  {returningInfo.confirmedGoldGrams}g)
                </span>
              </div>
            )}

            {/* 2. 모재 종류 / 정밀 중량(g) / 전처리 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-300">
                  모재 종류 선택
                </label>
                <select
                  value={formTrack}
                  onChange={(e) => {
                    const next = e.target.value as TrackType;
                    setFormTrack(next);
                    setFormPreprocess("none");
                  }}
                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="plating">
                    Track 1. 금도금 모재 (1일 · 오전 11시 접수분)
                  </option>
                  <option value="ic">Track 2. IC / BGA 칩 모재 (2일)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300">
                  예상 의뢰 중량 (1,000g ~ 5,000g)
                </label>
                <div className="relative mt-1.5">
                  <input
                    type="number"
                    min={1000}
                    max={5000}
                    step={10}
                    value={formWeightGrams}
                    onChange={(e) =>
                      setFormWeightGrams(
                        Math.max(
                          1000,
                          Math.min(5000, Number(e.target.value) || 1000)
                        )
                      )
                    }
                    className="w-full rounded-2xl border border-amber-500/40 bg-slate-950 py-3 pr-24 pl-4 font-mono text-sm font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-bold text-slate-400">
                    g ({(formWeightGrams / 1000).toFixed(2)}kg)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300">
                  전처리 여부
                </label>
                <select
                  value={formPreprocess}
                  onChange={(e) =>
                    setFormPreprocess(e.target.value as PreprocessOption)
                  }
                  className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="none">없음 (순수 탈거 모재)</option>
                  {formTrack === "plating" ? (
                    <option value="solder_removal">
                      납땜 제거 (+15,000원/kg)
                    </option>
                  ) : (
                    <option value="heatspreader_removal">
                      방열판 제거 (+25,000원/kg)
                    </option>
                  )}
                </select>
              </div>
            </div>

            {/* 3. 희망 정산 방식 */}
            <div>
              <label className="block text-xs font-bold text-slate-300">
                희망 정산 방식 (추출 완료 후 변경 가능)
              </label>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    settlementType === "physical_gold"
                      ? "border-amber-400 bg-amber-500/15 text-white"
                      : "border-white/10 bg-slate-950/60 text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="settlementType"
                    value="physical_gold"
                    checked={settlementType === "physical_gold"}
                    onChange={() => setSettlementType("physical_gold")}
                    className="h-4 w-4 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-sm font-bold">
                      순금 실물 (Gold Button) 수령
                    </div>
                    <div className="text-xs opacity-80">
                      작업비 결제 후 추출된 순금 비드 전량 안심 택배/방문 수령
                    </div>
                  </div>
                </label>

                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${
                    settlementType === "cash_transfer"
                      ? "border-emerald-400 bg-emerald-500/15 text-white"
                      : "border-white/10 bg-slate-950/60 text-slate-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="settlementType"
                    value="cash_transfer"
                    checked={settlementType === "cash_transfer"}
                    onChange={() => setSettlementType("cash_transfer")}
                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm font-bold">
                      종로 당일 시세 현금 정산 (즉시 입금)
                    </div>
                    <div className="text-xs opacity-80">
                      추출 순금 가치에서 작업비 차감 후 의뢰인 계좌 즉시 송금
                    </div>
                  </div>
                </label>
              </div>

              {/* =============================================================
                  [3-A] 순금 실물 수령 선택 시: 택배 수령(카카오 우편번호 API) 또는 방문 수령
              ============================================================= */}
              {settlementType === "physical_gold" && (
                <div className="mt-4 rounded-2xl border border-amber-500/30 bg-slate-950/85 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-amber-300">
                      📦 순금 비드(Gold Button) 수령 방법 및 주소지 입력
                    </span>
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                      카카오 우편번호 서비스 연동
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-bold transition ${
                        deliveryMethod === "courier"
                          ? "border-amber-400 bg-amber-500/15 text-white"
                          : "border-slate-800 bg-slate-900/70 text-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={deliveryMethod === "courier"}
                        onChange={() => setDeliveryMethod("courier")}
                        className="h-3.5 w-3.5 text-amber-500"
                      />
                      <span>
                        📮 우체국 안심소포(보험등기) 택배로 수령 (주소 입력)
                      </span>
                    </label>

                    <label
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-bold transition ${
                        deliveryMethod === "visit"
                          ? "border-amber-400 bg-amber-500/15 text-white"
                          : "border-slate-800 bg-slate-900/70 text-slate-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={deliveryMethod === "visit"}
                        onChange={() => setDeliveryMethod("visit")}
                        className="h-3.5 w-3.5 text-amber-500"
                      />
                      <span>
                        🏢 평택 정련실 직접 방문 수령 (고덕면 도시지원1길 116)
                      </span>
                    </label>
                  </div>

                  {deliveryMethod === "courier" ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="text"
                          readOnly
                          value={zonecode}
                          placeholder="우편번호 (5자리)"
                          onClick={handleOpenKakaoPostcode}
                          className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm font-bold text-amber-300 placeholder:font-sans placeholder:font-normal placeholder:text-slate-500 focus:outline-none sm:w-44"
                        />
                        <button
                          type="button"
                          onClick={handleOpenKakaoPostcode}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-amber-300"
                        >
                          <Search className="h-4 w-4" />
                          <span>우편번호 검색 (카카오 주소찾기)</span>
                        </button>
                      </div>

                      <input
                        type="text"
                        readOnly
                        value={roadAddress}
                        placeholder="우편번호 검색 시 도로명/지번 기본주소가 자동 입력됩니다"
                        onClick={handleOpenKakaoPostcode}
                        className="w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
                      />

                      <input
                        ref={detailAddressRef}
                        type="text"
                        value={detailAddress}
                        onChange={(e) => setDetailAddress(e.target.value)}
                        placeholder="상세주소 입력 (예: 208호, 동·호수·수령인 부서명 등) *"
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 text-xs text-slate-300">
                      • 작업 완료 알림 수신 후 신분증을 지참하시어{" "}
                      <strong className="text-amber-300">
                        경기도 평택시 고덕면 도시지원1길 116, 208호 (평택
                        G1지식산업센터)
                      </strong>
                      로 방문해 주시면 현장에서 전자저울 재검수 후 순금 비드를
                      인계해 드립니다.
                    </p>
                  )}
                </div>
              )}

              {/* =============================================================
                  [3-B] 현금 정산 선택 시: 입금계좌 + 예금주 명의 일치 확인 + 법인 출금 세법/세금공제 확인
              ============================================================= */}
              {settlementType === "cash_transfer" && (
                <div className="mt-4 space-y-4 rounded-2xl border border-emerald-500/40 bg-slate-950/90 p-4 sm:p-5">
                  {/* (1) 정산 계좌 입력 및 의뢰인 = 예금주 명의 일치 실시간 검증 */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-emerald-300">
                        💳 [필수 1] 현금 정산 입금계좌 및 예금주 본인 일치 확인
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                          isAccountHolderMatched
                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                            : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {isAccountHolderMatched
                          ? `✓ 의뢰인(${clientName.trim()}) = 예금주(${accountHolder.trim()}) 명의 일치`
                          : "⚠️ 의뢰인 성함과 예금주 명의 일치 필수"}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400">
                          입금 은행 선택 <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                        >
                          {KOREAN_BANKS.map((bank) => (
                            <option key={bank} value={bank}>
                              {bank}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400">
                          계좌번호 (&apos;-&apos; 포함 또는 숫자만){" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="예: 123-456-789012"
                          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 font-mono text-sm text-white placeholder:font-sans placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400">
                          예금주명 (의뢰인 성함/업체명과 동일){" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={accountHolder}
                          onChange={(e) => {
                            setAccountHolderTouched(true);
                            setAccountHolder(e.target.value);
                          }}
                          placeholder="예: 홍길동 / 대성메탈"
                          className={`mt-1 w-full rounded-xl border bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none ${
                            accountHolder.trim() && isAccountHolderMatched
                              ? "border-emerald-500/60"
                              : "border-rose-500/60"
                          }`}
                        />
                      </div>
                    </div>

                    {accountHolder.trim() && !isAccountHolderMatched && (
                      <p className="mt-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs font-semibold text-rose-300">
                        ⚠️ 입력하신 의뢰인 성함/업체명(
                        <strong>{clientName.trim() || "미입력"}</strong>)과
                        예금주명(<strong>{accountHolder.trim()}</strong>)이
                        다릅니다. 금융실명법 및 법인 출금 회계 규정상 타인 명의
                        계좌로는 송금이 불가합니다.
                      </p>
                    )}

                    <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={agreedAccountMatch}
                        onChange={(e) =>
                          setAgreedAccountMatch(e.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>
                        위 입금계좌는 <strong>의뢰인 본인(또는 동일 사업자)</strong>{" "}
                        명의 계좌가 맞으며, 명의 일치 여부를 확인하였습니다.
                      </span>
                    </label>
                  </div>

                  {/* (2) 법인 출금에 따른 세법 안내 및 세금공제 여부 선택·동의 */}
                  <div className="border-t border-slate-800 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-amber-300">
                        ⚖️ [필수 2] (주)이온랩 법인 출금 세법 안내 및 세금공제 확인
                      </span>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                        소득세법 제127조 · 법인세법 지출증빙 준수
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                      현금 정산 대금은{" "}
                      <strong className="text-white">
                        주식회사 이온랩 법인 계좌에서 출금
                      </strong>
                      되므로, 세법상 적격 증빙 또는 원천징수 세액 공제 절차가
                      필수입니다. 의뢰인 유형에 맞는 정산 방식을 선택해 주세요.
                    </p>

                    <div className="mt-3 space-y-2.5">
                      {/* 옵션 1: 개인 3.3% 사업소득 원천징수 */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs transition ${
                          taxOption === "personal_withholding_33"
                            ? "border-emerald-400 bg-emerald-500/15 text-white"
                            : "border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="taxOption"
                          checked={taxOption === "personal_withholding_33"}
                          onChange={() =>
                            setTaxOption("personal_withholding_33")
                          }
                          className="mt-0.5 h-4 w-4 text-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                            <span>
                              ① 개인 의뢰인 (표준) — 사업소득 3.3% 원천징수 세액
                              공제 후 송금
                            </span>
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                              3.3% 공제 (소득세 3% + 지방소득세 0.3%)
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300">
                            반복적 스크랩 수집·위탁 정산 시 소득세법 제127조에
                            따라 정산 수익금의 3.3%를 원천징수 공제하여 국세청에
                            신고·납부하고, 세후 차액을 즉시 송금합니다.
                          </p>
                        </div>
                      </label>

                      {/* 옵션 2: 비사업자 개인 일시적 소장 스크랩 매각 */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs transition ${
                          taxOption === "personal_exempt_scrap"
                            ? "border-emerald-400 bg-emerald-500/15 text-white"
                            : "border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="taxOption"
                          checked={taxOption === "personal_exempt_scrap"}
                          onChange={() =>
                            setTaxOption("personal_exempt_scrap")
                          }
                          className="mt-0.5 h-4 w-4 text-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                            <span>
                              ② 개인 비사업자 (일시적 보유 스크랩 처분) —
                              지출증빙(매입확인서·신분증) 확인 후 무공제 송금
                            </span>
                            <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                              세액공제 0% (신분증·매입확인서 필수)
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300">
                            영리 목적의 계속·반복성이 없는 일시적 개인 소장 부품
                            처분인 경우 과세대상에서 제외되나, 법인세법상
                            지출증빙(송금명세서 및 주민등록번호 기입 매입확인서)
                            제출에 동의하셔야 송금됩니다.
                          </p>
                        </div>
                      </label>

                      {/* 옵션 3: 개인/법인 사업자 세금계산서 */}
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-xs transition ${
                          taxOption === "business_invoice"
                            ? "border-emerald-400 bg-emerald-500/15 text-white"
                            : "border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="taxOption"
                          checked={taxOption === "business_invoice"}
                          onChange={() => setTaxOption("business_invoice")}
                          className="mt-0.5 h-4 w-4 text-emerald-500"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1 font-bold">
                            <span>
                              ③ 사업자 (개인/법인사업자) — 전자세금계산서 발행 및
                              매입자납부특례 정산
                            </span>
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                              원천징수 없음 (세금계산서 발행)
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-300">
                            사업자등록증 보유 업체로, 전자세금계산서 발행(또는
                            조세특례제한법 제106조의9 금 스크랩 매입자납부특례
                            전용계좌 정산) 방식으로 처리합니다.
                          </p>
                        </div>
                      </label>
                    </div>

                    {taxOption === "business_invoice" ? (
                      <div className="mt-3">
                        <label className="block text-[11px] font-bold text-amber-300">
                          사업자등록번호 입력{" "}
                          <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={businessNumber}
                          onChange={(e) => setBusinessNumber(e.target.value)}
                          placeholder="예: 272-87-04029"
                          className="mt-1 w-full rounded-xl border border-amber-500/50 bg-slate-900 px-3.5 py-2.5 font-mono text-sm text-white placeholder:font-sans placeholder-slate-500 focus:border-amber-400 focus:outline-none sm:w-72"
                        />
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-cyan-500/30 bg-slate-900/90 p-3.5 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="font-extrabold text-cyan-300">
                            🪪 세무사 원천징수(지급명세서) 신고용 본인확인 안내
                          </span>
                          <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                            소득세법 제164조 지급명세서 제출 의무
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                          법인에서 개인에게 3.3% 원천징수 후 송금(또는 비사업자
                          매입 지출증빙 처리)할 때, 담당 세무사가 국세청에
                          원천징수이행상황신고서 및 지급명세서를 제출하려면{" "}
                          <strong className="text-amber-300">
                            수령인의 주민등록번호(신분증 사본)
                          </strong>{" "}
                          확인이 필요합니다. 웹사이트에 주민번호 뒷자리를 직접
                          입력받지 않고, 아래 두 가지 안전한 방식 중 편하신 방법을
                          선택하실 수 있습니다.
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
                          <div className="sm:col-span-4">
                            <label className="block text-[11px] font-bold text-slate-300">
                              생년월일 6자리 (주민번호 앞자리)
                            </label>
                            <input
                              type="text"
                              maxLength={6}
                              value={residentBirthPrefix}
                              onChange={(e) =>
                                setResidentBirthPrefix(
                                  e.target.value.replace(/\D/g, "").slice(0, 6)
                                )
                              }
                              placeholder="예: 800101"
                              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm font-bold text-cyan-300 placeholder:font-sans placeholder:font-normal placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                            />
                          </div>

                          <div className="sm:col-span-8">
                            <label className="block text-[11px] font-bold text-slate-300">
                              세무 신고용 신분증 사본 제출 방식 선택
                            </label>
                            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <label
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                                  idCardDeliveryMethod === "send_before_payout"
                                    ? "border-cyan-400 bg-cyan-500/15 text-white"
                                    : "border-slate-800 bg-slate-950 text-slate-400"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="idCardDeliveryMethod"
                                  checked={
                                    idCardDeliveryMethod ===
                                    "send_before_payout"
                                  }
                                  onChange={() => {
                                    setIdCardDeliveryMethod(
                                      "send_before_payout"
                                    );
                                    setIdCardFile(null);
                                  }}
                                  className="h-3.5 w-3.5 text-cyan-400"
                                />
                                <span>
                                  추출 완료 후 송금 직전 별도 제출 (문자/카톡)
                                </span>
                              </label>

                              <label
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                                  idCardDeliveryMethod === "upload_now"
                                    ? "border-cyan-400 bg-cyan-500/15 text-white"
                                    : "border-slate-800 bg-slate-950 text-slate-400"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="idCardDeliveryMethod"
                                  checked={idCardDeliveryMethod === "upload_now"}
                                  onChange={() =>
                                    setIdCardDeliveryMethod("upload_now")
                                  }
                                  className="h-3.5 w-3.5 text-cyan-400"
                                />
                                <span>
                                  지금 신분증 사본 보안 첨부 (빠른 송금)
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {idCardDeliveryMethod === "upload_now" && (
                          <div className="mt-3 rounded-xl border border-dashed border-cyan-500/40 bg-slate-950/90 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-cyan-200">
                                🔒 신분증 사본(주민등록증·운전면허증) 이미지 첨부
                                — Cloudflare R2 보안 버킷에 암호화 저장되며 세무
                                신고 외 용도로 절대 사용되지 않습니다.
                              </span>
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files?.[0] || null;
                                setIdCardFile(f);
                              }}
                              className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-cyan-300 hover:file:bg-cyan-500/30"
                            />
                            {idCardFile && (
                              <div className="mt-1.5 flex items-center justify-between rounded-lg bg-cyan-500/15 px-2.5 py-1 text-[11px] text-cyan-200">
                                <span>
                                  ✓ 첨부됨: {idCardFile.name} (
                                  {(idCardFile.size / (1024 * 1024)).toFixed(2)}
                                  MB)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIdCardFile(null)}
                                  className="font-bold text-rose-300 hover:text-rose-200"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 실시간 원천징수 공제액 & 세후 실입금액 요약 박스 */}
                    <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-xs sm:grid-cols-3">
                      <div>
                        <span className="text-[11px] text-slate-400">
                          세전 예상 금 매입가액 (KRX 97.5%)
                        </span>
                        <p className="mt-0.5 font-mono text-sm font-bold text-white">
                          ₩{formatKRW(formEstimate.cashGoldValue)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-400">
                          원천징수 공제 (예상 {formTaxBreakdown.withholdingRatePercent}%)
                        </span>
                        <p className="mt-0.5 font-mono text-sm font-bold text-amber-300">
                          -₩{formatKRW(formTaxBreakdown.withholdingTaxAmount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-emerald-300">
                          세후 예상 실송금액
                        </span>
                        <p className="mt-0.5 font-mono text-base font-black text-emerald-400">
                          ₩{formatKRW(formTaxBreakdown.finalCashPayout)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200 leading-relaxed">
                      ⚖️ <strong>정산 금액 확정 기준 및 매입시세 안내:</strong> 상기 정산 금액은 접수 시점의 모재 예상치 기준 가계산된 시뮬레이션 금액입니다. <strong>실제 최종 정산 송금액은 STEP 03 공정 완료 후 정밀 전자저울로 실측된 실제 추출 순금량(g)과 정산 완료 당일의 [정련소 순금비드 매입 시세(KRX 공인 기준가의 97.5%)]를 적용하여 최종 확정</strong>되어 계좌로 송금됩니다. (※ STEP 01에서 선입금하신 작업비는 이중 차감하지 않고, 추출된 순금 매입대금 전액을 송금해 드립니다.)
                    </div>

                    <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3.5 py-2.5 text-xs text-slate-200">
                      <input
                        type="checkbox"
                        checked={agreedTaxPolicy}
                        onChange={(e) => setAgreedTaxPolicy(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>
                        <strong>[세금공제 확인 동의]</strong> 법인 출금에 따른
                        세법 안내사항을 확인하였으며, 위 선택한 세금공제(또는
                        적격 증빙 확인) 후 계좌로 송금받는 것에 동의합니다.
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* 4. 특이사항 및 99.9% 별도 상담 요청 메모 */}
            <div>
              <label className="block text-xs font-bold text-slate-300">
                특이사항 메모 (99.9% 고순도 정제 별도 상담 희망 시 기재)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="예: 우체국 택배 발송 예정 / 99.9% 정제 별도 상담 희망 등"
                className="mt-1.5 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* 5. 모재 상태 사진 첨부 */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">
                  모재 상태 사진 첨부 (선택, 최대 3장 · 스마트폰 촬영 즉시 업로드)
                </label>
                <span className="text-xs text-slate-400">
                  {uploadedPhotos.length} / 3장 첨부됨
                </span>
              </div>

              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="material-photo-upload"
                />
                <label
                  htmlFor="material-photo-upload"
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    uploadedPhotos.length >= 3
                      ? "pointer-events-none border-slate-800 bg-slate-950/40 opacity-50"
                      : "border-slate-700 bg-slate-950/70 hover:border-amber-400/60 hover:bg-slate-950"
                  }`}
                >
                  <Upload className="h-7 w-7 text-amber-400" />
                  <span className="mt-2 text-sm font-bold text-slate-200">
                    스마트폰 카메라 촬영 또는 모재 사진 업로드
                  </span>
                  <span className="mt-1 text-xs text-slate-400">
                    전체 물량 사진, 단면 확대 사진 첨부 시 빠른 입고 승인 가능
                  </span>
                </label>
              </div>

              {uploadedPhotos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {uploadedPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-950"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="h-24 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute top-1.5 right-1.5 rounded-full bg-slate-950/80 p-1 text-rose-400 hover:bg-rose-500 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="truncate px-2 py-1 text-[11px] text-slate-300">
                        {photo.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. 필수 동의 체크박스 및 법인 계좌 웹사이트 비노출 보안 고지 */}
            <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
              <div className="flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-2.5 text-xs text-cyan-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                <span>
                  <strong>[보안 안내 · 법인 계좌 웹사이트 비노출]</strong>{" "}
                  보이스피싱·3자 사기 등 범죄 악용을 예방하기 위해 (주)이온랩의
                  작업비 입금 계좌는 웹사이트에 공개하지 않으며,{" "}
                  <strong className="text-amber-300">
                    접수 완료 즉시 의뢰인 이메일로만 안전하게 개별 발송
                  </strong>
                  됩니다.
                </span>
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs leading-relaxed text-slate-300">
                  <strong className="text-amber-300">[필수 동의]</strong> 미분리
                  통기판 입고 불가 규정 및 최소 기본 작업비(도금 13만원 / 칩
                  23만원), 금도금 모재 1일 완성(오전 11시까지 접수분 한정) 정책을
                  확인하였으며, 습식 정련 공정 특성상 투입된 모재는 원형 복구가
                  불가함에 동의합니다.
                </span>
              </label>
            </div>

            {formError && (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs font-semibold text-rose-300">
                ⚠️ {formError}
              </div>
            )}

            {/* 예상 요금 요약 + 제출 버튼 */}
            <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row">
              <div className="text-center sm:text-left">
                <span className="text-xs text-slate-400">
                  선택 조건 기준 기본 작업비 (그램 비례 산출)
                </span>
                <div className="text-xl font-black text-amber-400">
                  ₩{formatKRW(formEstimate.standardTotal)}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    ({formEstimate.trackName} ·{" "}
                    {formEstimate.weight.toFixed(2)}kg /{" "}
                    {formEstimate.weightGrams.toLocaleString()}g)
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-4 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-60 sm:w-auto sm:text-base"
              >
                <FileText className="h-5 w-5" />
                <span>
                  {isSubmitting
                    ? "클라우드 접수 및 비밀번호 발송 중..."
                    : "위탁 정련 작업 신청서 발급하기"}
                </span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* =====================================================================
          Section 8. 자주 묻는 질문 (FAQ) & 금 추출 위탁 정련 가이드 (SEO Rich Snippet 연동)
      ===================================================================== */}
      <section
        id="faq"
        aria-labelledby="faq-heading"
        className="border-b border-white/10 bg-[#080C15] py-14 sm:py-20"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-extrabold text-cyan-300">
              FAQ · GOLD REFINING KNOWLEDGE BASE
            </span>
            <h2
              id="faq-heading"
              className="mt-3 text-2xl font-black text-white sm:text-3xl"
            >
              자주 묻는 질문 (소량 금 추출 · 위탁 정련 가이드)
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              금도금 핀·커넥터·단자 및 IC/BGA 반도체 칩 모재의 순금 회수율, 정련
              비용, 1인 1배치 단독 공정 및 세무 정산에 대해 가장 많이 문의하시는
              내용입니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {SEO_FAQ_ITEMS.map((item, idx) => (
              <article
                key={idx}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-lg transition hover:border-amber-500/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-300">
                      Q{idx + 1}. {item.category}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-sm font-extrabold leading-snug text-white sm:text-base">
                    {item.question}
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    {item.answer}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      </main>

      {/* =====================================================================
          Section 9. Footer (기업 신뢰 정보 + 지역/업종 SEO 키워드 + 관리자 콘솔 진입점)
      ===================================================================== */}
      <footer className="bg-[#05070C] py-12 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-2 text-base font-extrabold text-white">
                <FlaskConical className="h-5 w-5 text-amber-400" />
                <span>주식회사 이온랩 (IONLAB Co., Ltd.)</span>
              </div>
              <p className="mt-2 text-slate-400">
                소량 고순도 귀금속 정밀 습식 위탁 정련(임가공) & AI 비전 도시광산
                솔루션
              </p>
              <address className="mt-4 space-y-1 not-italic text-slate-400">
                <p>
                  • 대표이사: 박서진 &nbsp;|&nbsp; 사업자등록번호: 272-87-04029
                </p>
                <p>
                  • 정련센터 소재지: 경기도 평택시 고덕면 도시지원1길 116, 208호
                  (평택 G1지식산업센터)
                </p>
                <p>
                  • 고객상담 및 입고문의: 010-9761-9985 &nbsp;|&nbsp; 이메일:
                  contact@ionlab.kr
                </p>
                <p>
                  • 핵심 기술: 특허출원 제10-2026-0182129호 (선택적 금 회수 및
                  실리카 다중 여과 정련 공정)
                </p>
                <p>
                  • 패밀리 서비스:{" "}
                  <a
                    href="https://scan.techplay.blog"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 underline hover:text-cyan-300"
                  >
                    AI 무료 사전판독 스캐너 (scan.techplay.blog)
                  </a>
                </p>
              </address>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-slate-300">
                  <Lock className="h-4 w-4 text-amber-400" />
                  <span>컴플라이언스 및 안전 운영 고지</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-slate-400 transition hover:border-amber-400 hover:text-amber-300"
                >
                  <Settings className="h-3 w-3" />
                  <span>정련팀 관리자 콘솔</span>
                </button>
              </div>
              <p className="mt-2 leading-relaxed text-slate-400">
                본 서비스는 장물 및 출처 불명 귀금속 스크랩의 위탁을 엄격히
                금지하며, 적법한 전자스크랩 및 산업용 모재만을 대상으로 안전한
                표준 작업 절차(SOP)에 따라 운영됩니다.
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-center text-slate-500">
            © {new Date().getFullYear()} IONLAB Co., Ltd. All rights reserved.
          </div>
        </div>
      </footer>

      {/* =====================================================================
          모바일 하단 플로팅 퀵 바 (모바일 엄지 터치 최적화)
      ===================================================================== */}
      <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-white/10 bg-[#070A11]/95 px-3 py-2.5 backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={scrollToSimulator}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-bold text-slate-200"
          >
            <Calculator className="h-3.5 w-3.5 text-amber-400" />
            <span>수익계산기</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTrackerInitial({ email: "", phone: "", password: "" });
              setTrackerOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-300"
          >
            <Search className="h-3.5 w-3.5" />
            <span>로그·누적량</span>
          </button>
          <button
            type="button"
            onClick={scrollToOrderForm}
            className="flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-2.5 text-xs font-black text-slate-950"
          >
            <span>작업접수</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 접수 완료 모달 */}
      {receiptData && (
        <ReceiptModal
          receiptData={receiptData}
          onClose={() => setReceiptData(null)}
          onOpenTracker={(email, phone, password) => {
            setReceiptData(null);
            setTrackerInitial({ email, phone, password });
            setTrackerOpen(true);
          }}
        />
      )}

      {/* 의뢰인 전용 실시간 작업 로그 & 누적 금 추출량 조회 모달 */}
      {trackerOpen && (
        <ClientTrackerView
          initialEmail={trackerInitial.email}
          initialPhone={trackerInitial.phone}
          initialPassword={trackerInitial.password}
          onClose={() => setTrackerOpen(false)}
        />
      )}

      {/* 정련팀 전용 관리자 콘솔 모달 (`/admin` 페이지와 동일 기능) */}
      {adminOpen && <AdminDashboardView onClose={() => setAdminOpen(false)} />}
    </div>
  );
}
