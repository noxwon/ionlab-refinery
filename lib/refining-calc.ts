export type TrackType = "plating" | "ic";
export type PreprocessOption =
  | "none"
  | "solder_removal"
  | "heatspreader_removal";
export type SettlementType = "physical_gold" | "cash_transfer";
export type DeliveryMethod = "courier" | "visit";
export type TaxOptionType =
  | "personal_withholding_33"
  | "personal_exempt_scrap"
  | "business_invoice";

export const KOREAN_BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "새마을금고",
  "우체국",
  "SC제일은행",
  "신협",
  "수협은행",
  "BNK부산은행",
  "iM뱅크(대구)",
  "BNK경남은행",
  "광주은행",
  "전북은행",
  "제주은행",
] as const;

export interface UploadedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  sizeLabel: string;
}

export const REFINERY_BUY_RATE = 0.975; // KRX 공인 기준시세 대비 1차 정련 순금비드(98.5~99.5%) 정련소 매입가율 97.5% (고객 팔 때 시세)

export interface EstimateResult {
  track: TrackType;
  trackName: string;
  durationLabel: string;
  weight: number; // kg (소수점 지원, 예: 2.35)
  weightGrams: number; // g (1000 ~ 5000g)
  needsPreprocess: boolean;
  preprocessLabel: string;
  purityLabel: string;
  expectedGold: number; // g (소수점 1자리 정밀 지원, 예: 8.4)
  goldPrice: number;
  refineryBuyPrice: number; // 1g당 정련소 매입시세 (goldPrice * 0.975)
  baseCostA: number;
  preprocessCostB: number;
  chemicalCostC: number;
  standardTotal: number; // A + B
  totalGoldValueV: number; // V (KRX 100% 기준 실물 순금 가치)
  cashGoldValue: number; // 현금 정산 시 금 총 매입 평가액 (expectedGold * refineryBuyPrice)
  isHighYieldThresholdMet: boolean;
  highYieldThresholdGrams: number;
  highYieldRatePercent: number;
  ratioBasedCost: number; // (V * 0.10 or 0.12) + C + B
  isRatioApplied: boolean;
  finalWorkFee: number; // Math.max(A + B, ratioBasedCost)
  netClientProfit: number; // V - finalWorkFee (실물 수령 시 의뢰인 순수익)
}

export interface OrderSubmissionPayload {
  receiptNumber: string;
  submittedAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  accessPassword?: string;
  isReturningCustomer?: boolean;
  previousOrderCount?: number;
  cumulativeGoldGrams?: number;
  track: TrackType;
  weight: number; // kg
  weightGrams: number; // g
  preprocessOption: PreprocessOption;
  settlementType: SettlementType;
  // 실물 수령 시 배송/방문 정보
  deliveryMethod?: DeliveryMethod;
  zonecode?: string;
  roadAddress?: string;
  detailAddress?: string;
  // 현금 정산 시 입금계좌 및 법인 출금 세무 정보
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  isAccountHolderMatched?: boolean;
  taxOption?: TaxOptionType;
  taxOptionLabel?: string;
  businessNumber?: string;
  residentBirthPrefix?: string;
  idCardDeliveryMethod?: "upload_now" | "send_before_payout";
  idCardPhotoUrl?: string;
  withholdingTaxAmount?: number;
  finalCashPayout?: number;
  expectedGold: number;
  goldPrice: number;
  memo?: string;
  agreedToTerms?: boolean;
  photoNames: string[];
  photoUrls?: string[];
  uploadedPhotoUrls?: string[];
  emailSent?: boolean;
  emailId?: string;
  estimate: EstimateResult;
}

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(amount));
}

export function formatWeightDisplay(weightGrams: number): string {
  const kg = weightGrams / 1000;
  return `${kg.toFixed(2)}kg (${new Intl.NumberFormat("ko-KR").format(
    Math.round(weightGrams)
  )}g)`;
}

export function calculateTaxBreakdown(
  grossPayoutAmount: number,
  taxOption: TaxOptionType
): {
  taxOptionLabel: string;
  withholdingRatePercent: number;
  withholdingTaxAmount: number;
  finalCashPayout: number;
} {
  const safeGross = Math.max(0, Math.round(grossPayoutAmount));
  if (taxOption === "personal_withholding_33") {
    // 소득세 3% + 지방소득세 0.3% = 3.3% 원천징수 (10원 미만 절사 관행)
    const withholdingTaxAmount = Math.floor((safeGross * 0.033) / 10) * 10;
    return {
      taxOptionLabel:
        "개인(사업소득 3.3% 원천징수 공제 후 법인 계좌이체 · 지급명세서 신고)",
      withholdingRatePercent: 3.3,
      withholdingTaxAmount,
      finalCashPayout: safeGross - withholdingTaxAmount,
    };
  }
  if (taxOption === "personal_exempt_scrap") {
    return {
      taxOptionLabel:
        "개인(비사업자 일시 소장 스크랩 매각 · 매입확인서 및 신분증 지출증빙 확인 후 무공제 송금)",
      withholdingRatePercent: 0,
      withholdingTaxAmount: 0,
      finalCashPayout: safeGross,
    };
  }
  return {
    taxOptionLabel:
      "사업자(세금계산서 발행 / 금 스크랩 매입자납부특례 또는 임가공비 상계 정산)",
    withholdingRatePercent: 0,
    withholdingTaxAmount: 0,
    finalCashPayout: safeGross,
  };
}

export function calculateRefiningEstimate(
  track: TrackType,
  rawWeightInput: number, // g (1000~5000) 또는 kg (1~5) 모두 호환
  needsPreprocess: boolean,
  expectedGold: number,
  goldPrice: number
): EstimateResult {
  const isPlating = track === "plating";
  const weightGrams =
    rawWeightInput > 20
      ? Math.max(1000, Math.min(5000, Math.round(rawWeightInput)))
      : Math.max(1000, Math.min(5000, Math.round(rawWeightInput * 1000)));
  const weight = Number((weightGrams / 1000).toFixed(3));

  const trackName = isPlating
    ? "금도금 모재 (1일 완성)"
    : "IC / BGA 칩 모재 (2일 완성)";
  const durationLabel = isPlating
    ? "1일 공정 (당일 오전 11시까지 접수분 당일 완성)"
    : "2일 공정 (48시간 특수 정련)";

  // 1) 기본 작업비 (A) - 그램(g) 단위까지 부드럽게 비례 산출
  //    * 도금(Track 1): 기본 1kg 130,000원(기술료 5만 + 인건비 6만 + 실비 2만) + 추가 kg당 30,000원
  //    * 칩류(Track 2): 기본 1kg 230,000원(특수기술료 7만 + 인건비 12만 + 실비 4만) + 추가 kg당 60,000원
  const baseCostA = isPlating
    ? Math.round(130000 + Math.max(0, weight - 1) * 30000)
    : Math.round(230000 + Math.max(0, weight - 1) * 60000);

  // 2) 전처리 비용 (B) - 도금 15,000원/kg (1.5만원), 칩류 25,000원/kg (2.5만원)
  const preprocessUnit = isPlating ? 15000 : 25000;
  const preprocessCostB = needsPreprocess
    ? Math.round(weight * preprocessUnit)
    : 0;
  const preprocessLabel = needsPreprocess
    ? isPlating
      ? "주석/납(땜) 제거 전처리 포함 (+15,000원/kg)"
      : "방열판(구리 히트스프레더 뚜껑) 제거 포함 (+25,000원/kg)"
    : "전처리 없음 (즉시 투입 가능 순수 탈거 모재)";

  // 3) 순도 안내
  const purityLabel =
    "표준 1차 정련 (순도 98.5% ~ 99.5% 골드 비드 · 99.9%는 별도 상담)";

  // 4) 약품 실비 (C)
  const chemicalCostC = isPlating
    ? Math.round(weight * 20000)
    : Math.round(40000 + Math.max(0, weight - 1) * 30000);

  // 5) 추출 금 총 가치 (V) - 0.1g 단위 정밀 반영 (KRX 기준 도매 시세 100%)
  const cleanExpectedGold = Number(Number(expectedGold).toFixed(1));
  const totalGoldValueV = Math.round(cleanExpectedGold * goldPrice);

  // 5-1) 정련소 실물 순금비드(98.5~99.5%) 매입 시세 및 매입 평가액 (고객 팔 때 시세, KRX의 97.5%)
  const refineryBuyPrice = Math.round(goldPrice * REFINERY_BUY_RATE);
  const cashGoldValue = Math.round(cleanExpectedGold * refineryBuyPrice);

  // 6) 고수율 수수료 비교
  const highYieldThresholdGrams = isPlating ? 10 : 15;
  const highYieldRatePercent = isPlating ? 10 : 12;
  const isHighYieldThresholdMet = cleanExpectedGold > highYieldThresholdGrams;

  const standardTotal = baseCostA + preprocessCostB;
  const ratioBasedCost = isHighYieldThresholdMet
    ? Math.round(
        totalGoldValueV * (highYieldRatePercent / 100) +
          chemicalCostC +
          preprocessCostB
      )
    : 0;

  const finalWorkFee = isHighYieldThresholdMet
    ? Math.max(standardTotal, ratioBasedCost)
    : standardTotal;

  const isRatioApplied =
    isHighYieldThresholdMet && ratioBasedCost > standardTotal;

  // 7) 의뢰인 최종 수령액 (순수익)
  const netClientProfit = totalGoldValueV - finalWorkFee;

  return {
    track,
    trackName,
    durationLabel,
    weight,
    weightGrams,
    needsPreprocess,
    preprocessLabel,
    purityLabel,
    expectedGold: cleanExpectedGold,
    goldPrice,
    refineryBuyPrice,
    cashGoldValue,
    baseCostA,
    preprocessCostB,
    chemicalCostC,
    standardTotal,
    totalGoldValueV,
    isHighYieldThresholdMet,
    highYieldThresholdGrams,
    highYieldRatePercent,
    ratioBasedCost,
    isRatioApplied,
    finalWorkFee,
    netClientProfit,
  };
}
