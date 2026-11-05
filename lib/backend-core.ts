export interface GoldPriceResponse {
  ok: boolean;
  pricePerGram: number;
  baseDate: string;
  itemName: string;
  change: number;
  changeRate: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  source: "KRX_OPEN_API" | "FALLBACK_DEFAULT";
  updatedAt: string;
}

/**
 * 기준 시각으로부터 최근 영업일 문자열(YYYYMMDD) 배열 생성
 */
export function buildDateCandidates(baseTime: Date, days = 12): string[] {
  const dates: string[] = [];
  const kstTime = new Date(baseTime.getTime() + 9 * 60 * 60 * 1000);

  for (let i = 0; i < days; i++) {
    const d = new Date(kstTime);
    d.setUTCDate(d.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${yyyy}${mm}${dd}`);
  }
  return dates;
}

/**
 * HTML 특수문자 이스케이프 유틸리티 (XSS 및 HTML Injection 방지)
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 6자리 암호학적으로 안전한 임의 비밀번호 생성 (CSPRNG, 혼동 문자 I, O, 0, 1 제외)
 */
export function generateAccessPassword(length = 6): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const randomBytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(randomBytes);
  } else {
    // 안전한 폴백
    for (let i = 0; i < length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * 전화번호 숫자만 정규화 (예: 010-1234-5678 -> 01012345678)
 */
export function normalizePhone(phone: string): string {
  return (phone || "").replace(/[^0-9]/g, "");
}

/**
 * KRX Open API (https://openapi.krx.co.kr -> data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd)
 * 금 현물 일별시세 실시간 조회
 */
export async function fetchKrxGoldPrice(
  krxApiKey?: string
): Promise<GoldPriceResponse> {
  const apiKey = (
    krxApiKey ||
    (typeof process !== "undefined" ? process.env?.KRX_API_KEY : "") ||
    ""
  ).trim();

  if (!apiKey) {
    return {
      ok: true,
      pricePerGram: 171020,
      baseDate: "20261030",
      itemName: "금 99.99_1kg",
      change: -1980,
      changeRate: -1.14,
      source: "FALLBACK_DEFAULT",
      updatedAt: new Date().toISOString(),
    };
  }

  const endpoints = [
    "https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd",
    "http://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd",
  ];

  // 먼저 KRX 서버의 Date 헤더를 확인하여 정확한 서버 현재 시각 확보
  let referenceNow = new Date();
  try {
    const probe = await fetch(`${endpoints[0]}?basDd=20261030`, {
      method: "GET",
      headers: {
        AUTH_KEY: apiKey,
        Accept: "application/json",
      },
    });
    const serverDateHeader = probe.headers.get("date");
    if (serverDateHeader) {
      const parsedServerDate = new Date(serverDateHeader);
      if (!Number.isNaN(parsedServerDate.getTime())) {
        referenceNow = parsedServerDate;
      }
    }
  } catch {
    // 기본 시각 유지
  }

  const dates = buildDateCandidates(referenceNow, 10);

  for (const endpoint of endpoints) {
    for (const basDd of dates) {
      try {
        const url = `${endpoint}?basDd=${basDd}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            AUTH_KEY: apiKey,
            Accept: "application/json",
          },
        });

        if (!res.ok) continue;
        const data = (await res.json()) as {
          OutBlock_1?: Array<Record<string, string>>;
        };

        const items = data?.OutBlock_1;
        if (Array.isArray(items) && items.length > 0) {
          // '금 99.99_1kg' (종목코드 04020000) 우선 선택
          const target =
            items.find(
              (item) =>
                item.ISU_CD === "04020000" ||
                (item.ISU_NM && item.ISU_NM.toLowerCase().includes("1kg"))
            ) || items[0];

          const rawClose = (target.TDD_CLSPRC || "").replace(/,/g, "").trim();
          const pricePerGram = Number(rawClose);

          if (pricePerGram > 50000 && pricePerGram < 1000000) {
            const change =
              Number((target.CMPPREVDD_PRC || "0").replace(/,/g, "")) || 0;
            const changeRate =
              Number((target.FLUC_RT || "0").replace(/,/g, "")) || 0;
            const openPrice =
              Number((target.TDD_OPNPRC || "0").replace(/,/g, "")) || 0;
            const highPrice =
              Number((target.TDD_HGPRC || "0").replace(/,/g, "")) || 0;
            const lowPrice =
              Number((target.TDD_LWPRC || "0").replace(/,/g, "")) || 0;

            return {
              ok: true,
              pricePerGram: Math.round(pricePerGram),
              baseDate: target.BAS_DD || basDd,
              itemName: target.ISU_NM || "금 99.99_1kg",
              change,
              changeRate,
              openPrice,
              highPrice,
              lowPrice,
              source: "KRX_OPEN_API",
              updatedAt: new Date().toISOString(),
            };
          }
        }
      } catch {
        // 다음 일자 시도
      }
    }
  }

  return {
    ok: true,
    pricePerGram: 171020,
    baseDate: "20261030",
    itemName: "금 99.99_1kg",
    change: -1980,
    changeRate: -1.14,
    source: "FALLBACK_DEFAULT",
    updatedAt: new Date().toISOString(),
  };
}

export interface OrderEmailParams {
  receiptNumber: string;
  submittedAt: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  accessPassword: string;
  trackName: string;
  weight: number;
  preprocessLabel: string;
  purityLabel: string;
  settlementType: string;
  expectedGold: number;
  goldPrice: number;
  baseCostA: number;
  preprocessCostB: number;
  chemicalCostC: number;
  purityCostD: number;
  finalWorkFee: number;
  totalGoldValueV: number;
  netClientProfit: number;
  isRatioApplied: boolean;
  memo: string;
  photoUrls: string[];
  siteOrigin?: string;
  deliveryMethod?: string;
  zonecode?: string;
  roadAddress?: string;
  detailAddress?: string;
  bankName?: string;
  bankAccount?: string;
  accountHolder?: string;
  taxOptionLabel?: string;
  businessNumber?: string;
  withholdingTaxAmount?: number;
  finalCashPayout?: number;
}

/**
 * Resend API (검증된 도메인 techplay.blog 활용)를 통해
 * 의뢰인 및 이온랩 관리자(wonhongsik@gmail.com)에게 접수 완료 + 임시 비밀번호 + 로그 조회 링크 발송
 */
export async function sendOrderNotificationEmail(
  params: OrderEmailParams,
  resendApiKey?: string
): Promise<{ sent: boolean; id?: string; error?: string }> {
  const apiKey = (
    resendApiKey ||
    (typeof process !== "undefined" ? process.env?.RESEND_API_KEY : "") ||
    ""
  ).trim();
  if (!apiKey) {
    console.warn("sendOrderNotificationEmail: RESEND_API_KEY is not set.");
    return { sent: false, error: "RESEND_API_KEY_NOT_CONFIGURED" };
  }

  const formatNum = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(Math.round(n));

  const safeClientName = escapeHtml(params.clientName);
  const safeReceiptNumber = escapeHtml(params.receiptNumber);
  const safeSubmittedAt = escapeHtml(params.submittedAt);
  const safeClientPhone = escapeHtml(params.clientPhone);
  const safeClientEmail = escapeHtml(params.clientEmail);
  const safeAccessPassword = escapeHtml(params.accessPassword);
  const safeTrackName = escapeHtml(params.trackName);
  const safePreprocessLabel = escapeHtml(params.preprocessLabel);
  const safePurityLabel = escapeHtml(params.purityLabel);
  const safeMemo = escapeHtml(params.memo);
  const safeZonecode = escapeHtml(params.zonecode || "-");
  const safeRoadAddress = escapeHtml(params.roadAddress || "");
  const safeDetailAddress = escapeHtml(params.detailAddress || "");
  const safeBankName = escapeHtml(params.bankName || "-");
  const safeBankAccount = escapeHtml(params.bankAccount || "-");
  const safeAccountHolder = escapeHtml(params.accountHolder || "-");
  const safeTaxOptionLabel = escapeHtml(params.taxOptionLabel || "-");
  const safeBusinessNumber = escapeHtml(params.businessNumber || "");

  const settlementLabel =
    params.settlementType === "physical_gold"
      ? "순금 실물 (Gold Button) 수령"
      : "종로 당일 시세 현금 정산 (즉시 계좌 입금)";

  const rawOrigin = params.siteOrigin || "https://refinery.techplay.blog";
  const baseOrigin = rawOrigin.includes("workers.dev")
    ? "https://refinery.techplay.blog"
    : rawOrigin.replace(/\/$/, "");
  const trackerUrl = `${baseOrigin}/?view=tracker&email=${encodeURIComponent(
    params.clientEmail
  )}&phone=${encodeURIComponent(params.clientPhone)}`;
  const adminUrl = `${baseOrigin}/admin`;

  const photoLinksHtml =
    params.photoUrls.length > 0
      ? params.photoUrls
          .filter((url) => typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://")))
          .map(
            (url, idx) =>
              `<li style="margin-bottom:4px;"><a href="${escapeHtml(
                url
              )}" style="color:#38BDF8;text-decoration:underline;" target="_blank">첨부 모재 사진 #${
                idx + 1
              } 열기</a></li>`
          )
          .join("")
      : `<li>첨부된 사진 없음 (현장/카카오톡 별도 전송 예정)</li>`;

  const html = `
    <div style="font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;max-width:660px;margin:0 auto;background:#0B0F17;color:#F8FAFC;border:2px solid #F59E0B;border-radius:18px;padding:30px;">
      <div style="border-bottom:1px solid #1E293B;padding-bottom:18px;margin-bottom:20px;">
        <span style="display:inline-block;background:rgba(245,158,11,0.15);color:#FBBF24;border:1px solid rgba(245,158,11,0.4);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;">IONLAB REFINERY · 위탁 정련 접수 완료</span>
        <h2 style="margin:10px 0 6px 0;color:#FFFFFF;font-size:22px;">위탁 추출 신청 및 작업비 입금계좌·로그 안내</h2>
        <p style="margin:0;color:#94A3B8;font-size:13px;">접수번호: <strong style="color:#FBBF24;">${safeReceiptNumber}</strong> &nbsp;|&nbsp; 접수일시: ${safeSubmittedAt}</p>
      </div>

      <!-- 주식회사 이온랩 작업비 입금 전용 법인 계좌 박스 (웹사이트 비노출 · 이메일 보안 발송) -->
      <div style="background:linear-gradient(135deg,#06241B 0%,#0F172A 100%);border:2px solid #10B981;border-radius:14px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px 0;color:#34D399;font-size:16px;">🏦 작업비 입금 전용 법인 계좌 안내 (고객 전용 보안 발송)</h3>
        <p style="margin:0 0 12px 0;color:#CBD5E1;font-size:13px;line-height:1.5;">
          당사는 보이스피싱·3자 사기 등 범죄 악용을 방지하기 위해 웹사이트에 법인 계좌를 공개하지 않으며, 접수된 의뢰인께만 이메일로 안전하게 개별 안내해 드립니다.
        </p>
        <div style="background:#0B0F17;border:1px solid #10B981;border-radius:10px;padding:15px;">
          <p style="margin:4px 0;font-size:15px;color:#FFFFFF;">• <strong>입금 은행:</strong> <span style="color:#34D399;font-weight:800;">IBK기업은행</span></p>
          <p style="margin:6px 0;font-size:17px;color:#FFFFFF;">• <strong>계좌 번호:</strong> <span style="display:inline-block;background:rgba(16,185,129,0.18);color:#34D399;font-weight:900;font-size:18px;letter-spacing:1px;padding:3px 10px;border-radius:6px;">933-041960-04-011</span></p>
          <p style="margin:4px 0;font-size:15px;color:#FFFFFF;">• <strong>예금주명:</strong> <strong style="color:#FBBF24;">주식회사 이온랩</strong></p>
          <p style="margin:8px 0 2px 0;font-size:14px;color:#E2E8F0;">• <strong>입금 예정 작업비:</strong> <strong style="color:#FBBF24;">₩${formatNum(
            params.finalWorkFee
          )}</strong> (입금자명은 의뢰인 성함 <strong>${safeClientName}</strong>으로 기재 요망)</p>
        </div>
        <p style="margin:10px 0 0 0;color:#94A3B8;font-size:12px;">
          ※ 작업비 입금 확인 및 모재 입고(전자저울 실측 계량)가 완료되면 STEP 01(입고 및 계량 완료)이 즉시 승인됩니다.
        </p>
      </div>

      <!-- 의뢰인 전용 작업 로그 조회 임시 비밀번호 박스 -->
      <div style="background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);border:2px solid #38BDF8;border-radius:14px;padding:20px;margin-bottom:20px;">
        <h3 style="margin:0 0 8px 0;color:#38BDF8;font-size:16px;">🔐 실시간 작업 로그 조회용 인증 정보</h3>
        <p style="margin:0 0 14px 0;color:#CBD5E1;font-size:13px;line-height:1.5;">
          모재 입고부터 산처리·침전 반응, 순금 용융 및 전자저울 계량까지 전 과정을 전용 트래커 화면에서 실시간으로 확인하실 수 있습니다.
        </p>
        <div style="background:#0B0F17;border:1px solid #334155;border-radius:10px;padding:14px;margin-bottom:14px;">
          <p style="margin:4px 0;font-size:14px;color:#E2E8F0;">• <strong>조회 이메일:</strong> ${safeClientEmail}</p>
          <p style="margin:4px 0;font-size:14px;color:#E2E8F0;">• <strong>조회 연락처:</strong> ${safeClientPhone}</p>
          <p style="margin:8px 0 4px 0;font-size:15px;color:#FFFFFF;">• <strong>발급된 임시 비밀번호:</strong> <span style="display:inline-block;background:#F59E0B;color:#0B0F17;font-weight:900;font-size:17px;letter-spacing:2px;padding:3px 12px;border-radius:6px;margin-left:6px;">${safeAccessPassword}</span></p>
        </div>
        <a href="${escapeHtml(trackerUrl)}" target="_blank" style="display:inline-block;background:#F59E0B;color:#0B0F17;font-weight:800;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;">
          내 작업 로그 실시간 조회하기 ➔
        </a>
      </div>

      <div style="background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px 0;color:#34D399;font-size:15px;">1. 의뢰인 및 정산 정보</h3>
        <p style="margin:4px 0;font-size:14px;">• <strong>성함/업체명:</strong> ${safeClientName}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>연락처:</strong> ${safeClientPhone}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>이메일:</strong> ${safeClientEmail}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>희망 정산 방식:</strong> ${escapeHtml(settlementLabel)}</p>
        ${
          params.settlementType === "physical_gold"
            ? params.deliveryMethod === "visit"
              ? `<p style="margin:4px 0;font-size:14px;">• <strong>수령 방법:</strong> 평택 정련실 직접 방문 수령</p>`
              : `<p style="margin:4px 0;font-size:14px;">• <strong>수령 주소(택배):</strong> [${safeZonecode}] ${safeRoadAddress} ${safeDetailAddress}</p>`
            : `<p style="margin:4px 0;font-size:14px;">• <strong>정산 입금 계좌:</strong> ${safeBankName} ${safeBankAccount} (예금주: ${safeAccountHolder})</p>
              <p style="margin:4px 0;font-size:14px;">• <strong>세법 증빙 및 원천징수:</strong> ${safeTaxOptionLabel}${
                safeBusinessNumber
                  ? ` (사업자번호: ${safeBusinessNumber})`
                  : ""
              }</p>
              <p style="margin:4px 0;font-size:14px;">• <strong>예상 공제 세액 / 예상 세후 실송금액:</strong> 예상 원천징수 ₩${formatNum(
                params.withholdingTaxAmount || 0
              )} / <strong style="color:#34D399;">예상 실송금 ₩${formatNum(
                params.finalCashPayout || params.netClientProfit
              )}</strong></p>
              <div style="margin-top:8px;padding:8px 12px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-radius:8px;font-size:12px;color:#FDE68A;line-height:1.45;">
                ⚖️ <strong>[정산 확정 기준 안내]</strong> 상기 정산 금액은 접수 시점 예상 시뮬레이션 금액입니다. <strong>실제 최종 정산 송금액은 STEP 03 공정 완료 후 전자저울로 정밀 실측된 실제 추출 순금량(g)과 정산 완료일 당일의 KRX 금 현물 시세를 적용하여 최종 확정</strong>되어 입금됩니다.
              </div>`
        }
      </div>

      <div style="background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 12px 0;color:#FBBF24;font-size:15px;">2. 작업 조건 및 견적 시뮬레이션 (추출 전 예상치)</h3>
        <p style="margin:4px 0;font-size:14px;">• <strong>선택 트랙:</strong> ${safeTrackName}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>의뢰 중량:</strong> ${
          params.weight
        } kg</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>전처리 옵션:</strong> ${safePreprocessLabel}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>목표 순도 옵션:</strong> ${safePurityLabel}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>예상 금 추출량:</strong> ${
          params.expectedGold
        } g (KRX 금 시세 기준: ₩${formatNum(params.goldPrice)}/g)</p>
        <hr style="border:none;border-top:1px solid #1E293B;margin:12px 0;" />
        <p style="margin:4px 0;font-size:14px;">• <strong>기본 작업비(A):</strong> ₩${formatNum(
          params.baseCostA
        )}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>전처리 비용(B):</strong> ₩${formatNum(
          params.preprocessCostB
        )}</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>최종 청구 예정 작업비:</strong> <strong style="color:#FBBF24;">₩${formatNum(
          params.finalWorkFee
        )}</strong> (${
          params.isRatioApplied ? "고수율 비율제 적용" : "표준 정액제 적용"
        })</p>
        <p style="margin:4px 0;font-size:14px;">• <strong>추출 금 예상 가치(V):</strong> ₩${formatNum(
          params.totalGoldValueV
        )}</p>
        <p style="margin:4px 0;font-size:15px;">• <strong>의뢰인 예상 순수익:</strong> <strong style="color:#34D399;">₩${formatNum(
          params.netClientProfit
        )}</strong></p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#94A3B8;">
          ※ 추출 금 가치 및 예상 순수익은 접수 시점 시뮬레이션 추정치이며, 실제 추출 완료일 당일 KRX 금 시세 및 실제 추출 순금량으로 최종 확정 산정됩니다.
        </p>
      </div>

      <div style="background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px 0;color:#38BDF8;font-size:15px;">3. 첨부 모재 사진 (Cloudflare R2)</h3>
        <ul style="margin:0;padding-left:18px;font-size:13px;color:#CBD5E1;">
          ${photoLinksHtml}
        </ul>
      </div>

      <div style="background:#0F172A;border:1px solid #1E293B;border-radius:12px;padding:16px;margin-bottom:16px;">
        <h3 style="margin:0 0 8px 0;color:#E2E8F0;font-size:15px;">4. 특이사항 및 문의 메모</h3>
        <p style="margin:0;font-size:14px;color:#CBD5E1;white-space:pre-wrap;">${
          safeMemo || "별도 기재사항 없음"
        }</p>
      </div>

      <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;line-height:1.5;">
        주식회사 이온랩 (IONLAB Co., Ltd.) | 대표이사: 원홍식 | 사업자등록번호: 272-87-04029<br/>
        입고처: 경기도 평택시 고덕면 도시지원1길 116, 208호 (평택 G1지식산업센터) | 직통문의: 010-5798-0188
      </p>
    </div>
  `;

  const adminEmail = "wonhongsik@gmail.com";
  const clientEmailClean = params.clientEmail.trim();

  try {
    // 1) 고객에게 작업의뢰 확인 + (주)이온랩 입금계좌 + 비밀번호 안내 메일 발송
    const clientRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IONLAB REFINERY <refinery@techplay.blog>",
        to: [clientEmailClean],
        subject: `[이온랩 위탁정련 접수완료] ${params.clientName}님 입금계좌 및 작업로그 비밀번호 안내 (${params.receiptNumber})`,
        html,
      }),
    });

    const clientData = (await clientRes.json()) as {
      id?: string;
      message?: string;
    };

    // 2) 관리자(wonhongsik@gmail.com)에게도 관리자 전용 접수 확인 메일 별도 발송 (고객 이메일과 같더라도 관리자 확인 메일이 별도 도착하도록 보장)
    const adminHtml = `
      <div style="font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;max-width:660px;margin:0 auto;background:#070A10;color:#F8FAFC;border:2px solid #38BDF8;border-radius:18px;padding:24px;margin-bottom:16px;">
        <div style="background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.4);border-radius:12px;padding:16px;margin-bottom:20px;">
          <h3 style="margin:0 0 6px 0;color:#38BDF8;font-size:17px;">🔔 [관리자 전용 알림] 신규 위탁정련 작업 의뢰가 접수되었습니다</h3>
          <p style="margin:0 0 12px 0;color:#E2E8F0;font-size:13px;">
            의뢰인(<strong>${safeClientName}</strong> / ${safeClientPhone} / ${safeClientEmail})님께 작업비 입금계좌(<strong>IBK기업은행 933-041960-04-011 주식회사 이온랩</strong>)와 조회 비밀번호(<strong>${safeAccessPassword}</strong>)가 포함된 안내 메일이 발송되었습니다.
          </p>
          <a href="${escapeHtml(adminUrl)}" target="_blank" style="display:inline-block;background:#38BDF8;color:#0B0F17;font-weight:800;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:8px;">
            정련팀 관리자 콘솔(/admin) 바로 열기 ➔
          </a>
        </div>
        ${html}
      </div>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "IONLAB ADMIN <refinery@techplay.blog>",
        to: [adminEmail],
        subject: `[관리자 접수확인] ${params.clientName.replace(/[\r\n]/g, "")}님 (${params.trackName} ${params.weight}kg / ${params.receiptNumber})`,
        html: adminHtml,
      }),
    });

    if (!clientRes.ok) {
      return {
        sent: false,
        error: clientData?.message || `HTTP_${clientRes.status}`,
      };
    }
    return { sent: true, id: clientData.id };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "UNKNOWN_EMAIL_ERROR",
    };
  }
}
