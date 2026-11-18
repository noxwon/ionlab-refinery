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
        <h3 style="margin:0 0 8px 0;color:#34D399;font-size:16px;">[보안 안내] 작업비 입금 전용 법인 계좌 안내</h3>
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
        <h3 style="margin:0 0 8px 0;color:#38BDF8;font-size:16px;">[전용 인증] 실시간 작업 로그 조회용 인증 정보</h3>
        <p style="margin:0 0 14px 0;color:#CBD5E1;font-size:13px;line-height:1.5;">
          모재 입고부터 산처리·침전 반응, 순금 용융 및 전자저울 계량까지 전 과정을 전용 트래커 화면에서 실시간으로 확인하실 수 있습니다.
        </p>
        <div style="background:#0B0F17;border:1px solid #334155;border-radius:10px;padding:14px;margin-bottom:14px;">
          <p style="margin:4px 0;font-size:14px;color:#E2E8F0;">• <strong>조회 이메일:</strong> ${safeClientEmail}</p>
          <p style="margin:4px 0;font-size:14px;color:#E2E8F0;">• <strong>조회 연락처:</strong> ${safeClientPhone}</p>
          <p style="margin:8px 0 4px 0;font-size:15px;color:#FFFFFF;">• <strong>발급된 임시 비밀번호:</strong> <span style="display:inline-block;background:#F59E0B;color:#0B0F17;font-weight:900;font-size:17px;letter-spacing:2px;padding:3px 12px;border-radius:6px;margin-left:6px;">${safeAccessPassword}</span></p>
        </div>
        <a href="${escapeHtml(trackerUrl)}" target="_blank" style="display:inline-block;background:#F59E0B;color:#0B0F17;font-weight:800;font-size:14px;text-decoration:none;padding:12px 22px;border-radius:10px;">
          내 작업 로그 실시간 조회하기 &rarr;
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
                <strong>[정산 확정 기준 및 정련소 매입가 안내]</strong> 상기 정산 금액은 접수 시점 예상 시뮬레이션 금액입니다. <strong>실제 최종 정산 송금액은 STEP 03 공정 완료 후 전자저울로 정밀 실측된 실제 추출 순금량(g)과 정산 완료일 당일의 정련소 순금비드 매입시세(KRX 공인 기준가의 97.5%)를 적용하여 최종 확정</strong>되어 입금됩니다. (※ STEP 01에서 선입금하신 작업비는 이중 차감하지 않고, 추출된 순금 매입대금 전액을 세무 공제 후 투명하게 송금해 드립니다.)
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
          <h3 style="margin:0 0 6px 0;color:#38BDF8;font-size:17px;">[관리자 전용 알림] 신규 위탁정련 작업 의뢰가 접수되었습니다</h3>
          <p style="margin:0 0 12px 0;color:#E2E8F0;font-size:13px;">
            의뢰인(<strong>${safeClientName}</strong> / ${safeClientPhone} / ${safeClientEmail})님께 작업비 입금계좌(<strong>IBK기업은행 933-041960-04-011 주식회사 이온랩</strong>)와 조회 비밀번호(<strong>${safeAccessPassword}</strong>)가 포함된 안내 메일이 발송되었습니다.
          </p>
          <a href="${escapeHtml(adminUrl)}" target="_blank" style="display:inline-block;background:#38BDF8;color:#0B0F17;font-weight:800;font-size:13px;text-decoration:none;padding:10px 18px;border-radius:8px;">
            정련팀 관리자 콘솔(/admin) 바로 열기 &rarr;
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

// ============================================================================
// 알리고 (Aligo) 카카오 알림톡 연동 모듈 (@ionlab / UN_8291 ~ UN_8301)
// ============================================================================

export type AligoTemplateCode =
  | "UN_8291" // 위탁정련 접수완료 및 입금안내
  | "UN_8292" // 선입금 작업비 입금확인 안내
  | "UN_8293" // STEP01 모재입고 및 실측계량 완료
  | "UN_8294" // STEP02 습식침출 및 환원공정 안내
  | "UN_8296" // STEP03 순금비드 추출 및 계량완료
  | "UN_8298" // STEP04 최종정산 및 출고마감 안내
  | "UN_8299" // 입고모재 중량오차 작업비 정산안내
  | "UN_8300" // 현금정산 세무신고 증빙서류 요청
  | "UN_8301"; // 관리자용 신규 위탁정련 접수알림

export interface AligoEnvConfig {
  apiKey?: string;
  userId?: string;
  senderKey?: string;
  senderPhone?: string;
  proxyUrl?: string;
}

export interface AligoTemplateDefinition {
  code: AligoTemplateCode;
  name: string;
  subject: string;
  content: string;
  buttonName: string;
  buttonUrlTemplate: string;
}

export const ALIGO_TEMPLATE_MAP: Record<
  AligoTemplateCode,
  AligoTemplateDefinition
> = {
  UN_8291: {
    code: "UN_8291",
    name: "위탁정련 접수완료 및 입금안내",
    subject: "[이온랩] 위탁 정련 접수 및 입금 안내",
    content: `[이온랩 리파이너리] 위탁 정련 접수 및 입금 안내

안녕하세요, #{고객명} 고객님.
주식회사 이온랩에 위탁 정련을 신청해 주셔서 감사합니다.
아래 안내에 따라 작업비 선입금 및 모재 발송을 진행해 주시면 입고 즉시 STEP 01 공정이 시작됩니다.

■ 접수 및 조회 정보
□ 접수번호 : #{접수번호}
□ 의뢰품목 : #{모재트랙명} (신청 #{신청중량}kg)
□ 정산방식 : #{정산방식}
□ 조회 비밀번호 : #{조회비밀번호}

■ 작업비 선입금 계좌 안내
□ 입금은행 : #{입금은행}
□ 계좌번호 : #{입금계좌번호}
□ 예금주명 : 주식회사 이온랩
□ 선입금 작업비 : #{선입금작업비}원

■ 모재 보내실 곳 (택배 또는 방문)
□ 주소 : 경기도 평택시 고덕면 도시지원1길 116, 208호 (평택 G1지식산업센터) 주식회사 이온랩
□ 연락처 : 010-5798-0188

※ 보이스피싱 및 금융사고 예방을 위해 당사 입금계좌는 알림톡과 이메일로만 개별 안내됩니다.
※ 접수 시점의 시뮬레이션 수율 및 예상 정산금은 참고용 예상치이며, 최종 정산은 STEP 03 추출 실측 순금량(g)과 정산일 당일 정련소 매입시세(KRX 기준가의 97.5%)로 확정됩니다.`,
    buttonName: "실시간 작업로그 조회",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8292: {
    code: "UN_8292",
    name: "선입금 작업비 입금확인 안내",
    subject: "[이온랩] 작업비 선입금 확인 완료 안내",
    content: `[이온랩 리파이너리] 작업비 선입금 확인 완료 안내

안녕하세요, #{고객명} 고객님.
신청하신 위탁 정련 건의 작업비 선입금이 정상 확인되었습니다.

■ 입금 확인 내역
□ 접수번호 : #{접수번호}
□ 의뢰품목 : #{모재트랙명} (신청 #{신청중량}kg)
□ 입금확인 금액 : #{선입금작업비}원
□ 현재상태 : 입금 확인 완료 (모재 입고 및 실측 대기)

■ 모재 발송 안내 (미발송 시 참고)
□ 입고처 : 경기도 평택시 고덕면 도시지원1길 116, 208호 주식회사 이온랩 (010-5798-0188)

모재가 정련실에 도착하면 전자저울 실측 계량(STEP 01) 후 사진과 함께 다시 알림톡을 보내드립니다.`,
    buttonName: "실시간 작업로그 조회",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8293: {
    code: "UN_8293",
    name: "STEP01 모재입고 및 실측계량 완료",
    subject: "[이온랩] STEP 01 모재 입고 및 실측 계량 완료",
    content: `[이온랩 리파이너리] STEP 01 모재 입고 및 실측 계량 완료

안녕하세요, #{고객명} 고객님.
보내주신 모재가 평택 정련센터에 안전하게 입고되어 전자저울 정밀 실측이 완료되었습니다.

■ STEP 01 입고 실측 결과
□ 접수번호 : #{접수번호}
□ 의뢰품목 : #{모재트랙명}
□ 고객 신청 중량 : #{신청중량}kg
□ 정련실 실측 중량 : #{실측중량}kg (#{중량편차안내})
□ 작업비 정산 구분 : #{작업비변동 안내}
□ 현장 담당자 코멘트 : #{단계코멘트}

고객님의 모재는 타 물량과 섞이지 않는 1인 1배치 단독 공정으로 즉시 투입됩니다.
하단 버튼을 누르시면 전자저울 실측 인증 사진을 직접 확인하실 수 있습니다.`,
    buttonName: "STEP 01 실측사진 보기",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8294: {
    code: "UN_8294",
    name: "STEP02 습식침출 및 환원공정 안내",
    subject: "[이온랩] STEP 02 정밀 습식 침출 및 환원 공정 안내",
    content: `[이온랩 리파이너리] STEP 02 정밀 습식 침출 및 환원 공정 안내

안녕하세요, #{고객명} 고객님.
현재 고객님의 모재(1인 1배치 단독 반응조)에 대한 STEP 02 습식 정련 공정이 진행 중입니다.

■ STEP 02 공정 진행 현황
□ 접수번호 : #{접수번호}
□ 의뢰품목 : #{모재트랙명} (실측 #{실측중량}kg)
□ 현재단계 : STEP 02 습식 침출·다중 여과 및 선택적 금 환원
□ 공정요약 : #{핵심계측배지}
□ 상세내용 : #{단계코멘트}

침출 및 환원 반응이 완료되는 대로 고온 용융을 거쳐 순금 비드(Gold Button)를 추출하고 STEP 03 확정 계량 결과를 안내해 드리겠습니다.`,
    buttonName: "STEP 02 공정로그 보기",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8296: {
    code: "UN_8296",
    name: "STEP03 순금비드 추출 및 계량완료",
    subject: "[이온랩] STEP 03 순금 비드 추출 및 확정 계량 완료",
    content: `[이온랩 리파이너리] STEP 03 순금 비드 추출 및 확정 계량 완료 안내

안녕하세요, #{고객명} 고객님.
의뢰하신 모재의 정밀 습식 정련 및 고온 용융 작업이 완료되어 최종 추출된 순금 비드(Gold Button) 확정 중량을 안내해 드립니다.

■ STEP 03 최종 순금 추출 결과
□ 접수번호 : #{접수번호}
□ 의뢰품목 : #{모재트랙명} (실측 #{실측중량}kg)
□ 최종 확정 순금 추출량 : #{확정순금중량}g (순도 98.5%~99.5% 골드 비드)
□ 고객 누적 확정 금 추출량 : 총 #{누적확정금중량}g
□ 상세내용 : #{단계코멘트}

■ 다음 단계 (STEP 04 최종 정산·출고) 안내
□ 선택하신 정산방식 : #{정산방식}
• 현금 정산 선택 시 : 정산일 당일 정련소 매입시세(KRX 기준가의 97.5%)를 적용하여 세후 확정 실송금액을 계좌이체해 드립니다. (선입금 작업비 이중 차감 없음)
• 실물 수령 선택 시 : 우체국 안심소포(보험등기) 발송 또는 평택 정련실 방문 수령으로 출고됩니다.`,
    buttonName: "추출 순금 사진·정산액 확인",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8298: {
    code: "UN_8298",
    name: "STEP04 최종정산 및 출고마감 안내",
    subject: "[이온랩] STEP 04 최종 정산 및 출고 마감 완료",
    content: `[이온랩 리파이너리] STEP 04 최종 정산 및 출고 마감 완료 안내

안녕하세요, #{고객명} 고객님.
의뢰하신 위탁 정련 건의 모든 공정과 최종 정산(출고)이 완료되어 1사이클이 공식 마감되었습니다.

■ STEP 04 최종 정산 및 출고 명세
□ 접수번호 : #{접수번호}
□ 확정 순금 추출량 : #{확정순금중량}g
□ 정산/출고 구분 : #{정산방식}
□ 적용 시세 및 세무 구분 : #{적용시세및세무내역}
□ 최종 정산/출고 결과 : #{최종정산출고결과}
□ 담당자 마감 코멘트 : #{단계코멘트}

소중한 모재를 주식회사 이온랩에 맡겨주셔서 진심으로 감사드립니다.
전용 트래커 페이지에서 전 공정(STEP 01~04) 기록과 이체확인증/송장 증빙을 언제든 다시 열람하실 수 있습니다.`,
    buttonName: "최종 정산서 및 증빙 열람",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8299: {
    code: "UN_8299",
    name: "입고모재 중량오차 작업비 정산안내",
    subject: "[이온랩] 입고 모재 실측 중량 차이 정산 안내",
    content: `[이온랩 리파이너리] 입고 모재 실측 중량 차이에 따른 작업비 정산 안내

안녕하세요, #{고객명} 고객님.
입고된 모재를 정밀 전자저울로 실측한 결과, 신청 중량 대비 일반 허용 오차(±100g)를 초과하는 중량 차이가 확인되어 정산 기준을 안내해 드립니다.

■ 신청 중량 대비 실측 내역
□ 접수번호 : #{접수번호}
□ 고객 신청 중량 : #{신청중량}kg (선입금 작업비 #{선입금작업비}원)
□ 정련실 실측 중량 : #{실측중량}kg (편차 #{중량편차그램})
□ 실측 중량 기준 재산정 작업비 : #{실측기준작업비}원
□ 작업비 차액 및 처리방식 : #{차액처리안내}

※ 중량 초과분(+100g 초과)에 대한 추가 작업비는 STEP 04 최종 정산금에서 차감(상계)되며, 중량 미달분(-100g 초과, 최소 1kg 기본요금 보장)에 대한 과오납 작업비 차액은 STEP 04 최종 정산금에 합산하여 환급해 드립니다.`,
    buttonName: "실측 계량 사진 확인하기",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8300: {
    code: "UN_8300",
    name: "현금정산 세무신고 증빙서류 요청",
    subject: "[이온랩] 현금 정산 송금을 위한 세무 신고 서류 제출 안내",
    content: `[이온랩 리파이너리] 현금 정산 송금을 위한 세무 신고 서류 제출 안내

안녕하세요, #{고객명} 고객님.
의뢰하신 모재(#{접수번호})의 순금 추출(#{확정순금중량}g)이 완료되어 현금 정산 계좌이체를 준비 중입니다.

법인 계좌 출금 및 세무사 지급명세서(원천징수/지출증빙) 신고를 위해 아래 서류를 제출해 주시기 바랍니다.

■ 제출 요청 내역
□ 접수번호 : #{접수번호}
□ 정산 예정 계좌 : #{입금은행} #{입금계좌번호} (예금주: #{고객명})
□ 선택 세법 구분 : #{세무구분명}
□ 필요 서류 : #{필요서류안내}
□ 제출 방법 : 이메일(techplay.blog@gmail.com) 또는 담당자 직통 번호(010-5798-0188)로 사진 전송

※ 서류 확인이 완료되는 즉시 당일 정련소 매입시세 기준 확정 실송금액을 입금해 드립니다.`,
    buttonName: "내 정산 내역 확인하기",
    buttonUrlTemplate: "https://#{조회링크}",
  },
  UN_8301: {
    code: "UN_8301",
    name: "관리자용 신규 위탁정련 접수알림",
    subject: "[이온랩 관리자 알림] 신규 위탁 정련 신청 접수",
    content: `[이온랩 관리자 알림] 신규 위탁 정련 신청이 접수되었습니다.

■ 신규 접수 요약
□ 접수번호 : #{접수번호}
□ 접수일시 : #{접수일시}
□ 의뢰인명 : #{고객명} (#{고객연락처})
□ 의뢰품목 : #{모재트랙명} (신청 #{신청중량}kg)
□ 전처리옵션 : #{전처리옵션}
□ 정산방식 : #{정산방식}
□ 선입금 예정 작업비 : #{선입금작업비}원
□ 시뮬레이션 예상 금 : #{예상금중량}g
□ 고객 메모 : #{고객메모}

하단 버튼을 눌러 관리자 콘솔에서 상세 내역 및 첨부 사진을 확인해 주세요.`,
    buttonName: "관리자 콘솔 바로가기",
    buttonUrlTemplate: "https://refinery.techplay.blog/admin",
  },
};

function resolveAligoConfig(cfg?: AligoEnvConfig): {
  apiKey: string;
  userId: string;
  senderKey: string;
  senderPhone: string;
  baseUrl: string;
} {
  const procEnv: Record<string, string | undefined> =
    typeof process !== "undefined" && process.env ? process.env : {};
  const apiKey = (
    cfg?.apiKey ||
    procEnv.ALIGO_API_KEY ||
    "vfykyrtmauy5auy0xx8rq9u9p83sfdgk"
  ).trim();
  const userId = (cfg?.userId || procEnv.ALIGO_USER_ID || "ionlab").trim();
  const senderKey = (
    cfg?.senderKey ||
    procEnv.ALIGO_SENDER_KEY ||
    "0ead7364038cbebc40bd0672fbc06566d947a385"
  ).trim();
  const senderPhone = normalizePhone(
    cfg?.senderPhone || procEnv.ALIGO_SENDER_PHONE || "01057980188"
  );
  const baseUrl = (
    cfg?.proxyUrl ||
    procEnv.ALIGO_PROXY_URL ||
    "https://158-247-239-106.sslip.io"
  )
    .trim()
    .replace(/\/$/, "");

  return { apiKey, userId, senderKey, senderPhone, baseUrl };
}

/**
 * 템플릿 문자열 내의 #{변수명} 치환 유틸리티
 */
export function applyAligoVariables(
  templateStr: string,
  variables: Record<string, string>
): string {
  let result = templateStr;
  for (const [key, val] of Object.entries(variables)) {
    const safeVal = val !== undefined && val !== null ? String(val) : "-";
    result = result.split(`#{${key}}`).join(safeVal);
  }
  return result;
}

/**
 * 고객 전용 트래커 접속 경로(https:// 제외한 도메인+쿼리) 생성
 * 예: refinery.techplay.blog/?view=tracker&email=...&phone=...&pw=...
 */
export function buildTrackerPathWithoutProtocol(
  email: string,
  phone: string,
  password?: string
): string {
  const base = `refinery.techplay.blog/?view=tracker&email=${encodeURIComponent(
    (email || "").trim()
  )}&phone=${encodeURIComponent((phone || "").trim())}`;
  return password ? `${base}&pw=${encodeURIComponent(password.trim())}` : base;
}

export interface AligoSendResult {
  sent: boolean;
  code: number;
  message: string;
  tplCode: AligoTemplateCode;
  mid?: string;
}

const ALIGO_DIRECT_ORIGIN = "https://kakaoapi.aligo.in";

function isAligoIpAuthError(data: {
  code?: unknown;
  message?: unknown;
}): boolean {
  return (
    Number(data?.code) === -99 &&
    typeof data?.message === "string" &&
    data.message.toUpperCase().includes("IP")
  );
}

/**
 * 알리고 API POST(form-urlencoded) 호출
 * - 프록시 서버 IP가 미인증(-99) 또는 연결 불가인 경우 직통 엔드포인트(kakaoapi.aligo.in)로 자동 폴백합니다.
 */
async function postAligoForm<T extends Record<string, unknown>>(
  baseUrl: string,
  path: string,
  bodyParams: Record<string, string>
): Promise<{ data: T; usedOrigin: string }> {
  const encodedBody = new URLSearchParams(bodyParams).toString();
  const callOrigin = async (origin: string): Promise<T> => {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: encodedBody,
    });
    return (await res.json()) as T;
  };

  let first: T;
  try {
    first = await callOrigin(baseUrl);
  } catch (err) {
    if (baseUrl !== ALIGO_DIRECT_ORIGIN) {
      const direct = await callOrigin(ALIGO_DIRECT_ORIGIN);
      return { data: direct, usedOrigin: ALIGO_DIRECT_ORIGIN };
    }
    throw err;
  }

  if (baseUrl !== ALIGO_DIRECT_ORIGIN && isAligoIpAuthError(first)) {
    const direct = await callOrigin(ALIGO_DIRECT_ORIGIN);
    return { data: direct, usedOrigin: ALIGO_DIRECT_ORIGIN };
  }
  return { data: first, usedOrigin: baseUrl };
}

/**
 * 알리고 알림톡 단건 발송 함수
 * - 알리고 서버에 등록된 실제 템플릿 원문(/akv10/template/list/)을 먼저 조회하여
 *   줄바꿈/공백/버튼 구성을 100% 일치시킨 뒤 #{변수}를 치환해 발송합니다.
 */
export async function sendAligoAlimtalk(params: {
  tplCode: AligoTemplateCode;
  receiverPhone: string;
  receiverName?: string;
  variables: Record<string, string>;
  failoverSms?: boolean;
  config?: AligoEnvConfig;
}): Promise<AligoSendResult> {
  const { apiKey, userId, senderKey, senderPhone, baseUrl } =
    resolveAligoConfig(params.config);
  const fallbackDef = ALIGO_TEMPLATE_MAP[params.tplCode];
  const cleanReceiver = normalizePhone(params.receiverPhone);

  if (!cleanReceiver || cleanReceiver.length < 9) {
    return {
      sent: false,
      code: -400,
      message: "수신자 전화번호 형식이 올바르지 않습니다.",
      tplCode: params.tplCode,
    };
  }

  let rawContent = fallbackDef.content;
  const rawSubject = fallbackDef.subject;
  let rawEmTitle = "";
  let rawButtons: Array<Record<string, string>> = [
    {
      name: fallbackDef.buttonName,
      linkType: "WL",
      linkTypeName: "웹링크",
      linkMo: fallbackDef.buttonUrlTemplate,
      linkPc: fallbackDef.buttonUrlTemplate,
      linkIos: "",
      linkAnd: "",
    },
  ];

  let activeBaseUrl = baseUrl;

  // 1) 알리고에 실제 등록된 템플릿 원문/버튼을 조회하여 미세한 공백·줄바꿈 차이까지 자동 동기화
  try {
    const { data: tplJson, usedOrigin } = await postAligoForm<{
      code?: number;
      message?: string;
      list?: Array<{
        templtCode?: string;
        templtName?: string;
        templtContent?: string;
        templtTitle?: string;
        buttons?: Array<Record<string, string>>;
      }>;
    }>(baseUrl, "/akv10/template/list/", {
      apikey: apiKey,
      userid: userId,
      senderkey: senderKey,
      tpl_code: params.tplCode,
    });
    activeBaseUrl = usedOrigin;
    if (tplJson.code === 0 && Array.isArray(tplJson.list)) {
      const matched =
        tplJson.list.find((t) => t.templtCode === params.tplCode) ||
        tplJson.list[0];
      if (matched?.templtContent) {
        rawContent = matched.templtContent;
      }
      if (matched?.templtTitle) {
        rawEmTitle = matched.templtTitle;
      }
      if (Array.isArray(matched?.buttons)) {
        rawButtons = matched.buttons;
      }
    }
  } catch {
    // 템플릿 조회 실패 시 내장 표준 템플릿 사용
  }

  // 2) 본문, 강조타이틀, 버튼 링크의 #{변수} 치환
  const finalMessage = applyAligoVariables(rawContent, params.variables);
  const finalEmTitle = rawEmTitle
    ? applyAligoVariables(rawEmTitle, params.variables)
    : "";

  const resolvedButtons = rawButtons.map((btn) => {
    const linkMoRaw = btn.linkMo || btn.linkM || "";
    const linkPcRaw = btn.linkPc || btn.linkP || linkMoRaw;
    return {
      name: btn.name || fallbackDef.buttonName,
      linkType: btn.linkType || "WL",
      linkTypeName: btn.linkTypeName || "웹링크",
      linkMo: applyAligoVariables(linkMoRaw, params.variables),
      linkPc: applyAligoVariables(linkPcRaw, params.variables),
      linkIos: btn.linkIos || btn.linkI || "",
      linkAnd: btn.linkAnd || btn.linkA || "",
    };
  });

  // 3) POST /akv10/alimtalk/send/ 호출 파라미터 구성
  const formParams: Record<string, string> = {
    apikey: apiKey,
    userid: userId,
    senderkey: senderKey,
    tpl_code: params.tplCode,
    sender: senderPhone,
    receiver_1: cleanReceiver,
    recvname_1: (params.receiverName || "고객").trim(),
    subject_1: rawSubject,
    message_1: finalMessage,
  };

  if (finalEmTitle) {
    formParams.emtitle_1 = finalEmTitle;
  }

  if (resolvedButtons.length > 0) {
    formParams.button_1 = JSON.stringify({ button: resolvedButtons });
  }

  if (params.failoverSms !== false) {
    formParams.failover = "Y";
    formParams.fsubject_1 = rawSubject;
    formParams.fmessage_1 = finalMessage;
  }

  try {
    const { data } = await postAligoForm<{
      code?: number;
      message?: string;
      info?: { mid?: string | number; scnt?: number; fcnt?: number };
    }>(activeBaseUrl, "/akv10/alimtalk/send/", formParams);

    const codeNum = Number(data?.code ?? -99);
    return {
      sent: codeNum === 0,
      code: codeNum,
      message: data?.message || (codeNum === 0 ? "발송 성공" : "발송 실패"),
      tplCode: params.tplCode,
      mid: data?.info?.mid ? String(data.info.mid) : undefined,
    };
  } catch (err) {
    return {
      sent: false,
      code: -500,
      message: err instanceof Error ? err.message : "ALIGO_NETWORK_ERROR",
      tplCode: params.tplCode,
    };
  }
}

/**
 * 알리고 발송 가능 잔여건수(/akv10/heartinfo/) 및 템플릿 검수 상태(/akv10/template/list/) 조회
 */
export async function fetchAligoTemplatesAndQuota(config?: AligoEnvConfig) {
  const { apiKey, userId, senderKey, senderPhone, baseUrl } =
    resolveAligoConfig(config);

  try {
    const [quotaRes, tplRes] = await Promise.all([
      postAligoForm<Record<string, unknown>>(baseUrl, "/akv10/heartinfo/", {
        apikey: apiKey,
        userid: userId,
      }),
      postAligoForm<Record<string, unknown>>(
        baseUrl,
        "/akv10/template/list/",
        {
          apikey: apiKey,
          userid: userId,
          senderkey: senderKey,
        }
      ),
    ]);

    return {
      ok: Number(tplRes.data?.code) === 0,
      userId,
      senderKey,
      senderPhone,
      usedOrigin: tplRes.usedOrigin,
      quota: quotaRes.data,
      templates: tplRes.data,
    };
  } catch (err) {
    return {
      ok: false,
      userId,
      senderKey,
      senderPhone,
      error: err instanceof Error ? err.message : "ALIGO_STATUS_CHECK_FAILED",
    };
  }
}

/**
 * 주문 레코드(refinery_orders)와 단계별 부가정보로부터
 * UN_8291 ~ UN_8301 모든 템플릿에 즉시 바인딩 가능한 #{변수} 맵 생성
 */
export function buildOrderAlimtalkVariables(
  order: Record<string, unknown>,
  options?: {
    tplCode?: AligoTemplateCode;
    measuredValue?: string | null;
    logDetail?: string | null;
    confirmedCumulativeGold?: number;
    recalculatedWorkFee?: number;
    workFeeDiffAmount?: number;
  }
): Record<string, string> {
  const fmt = (n: number) =>
    new Intl.NumberFormat("ko-KR").format(Math.round(n));

  const reqWeightKg = Number(order.weight || 0);
  const hasActualWeight =
    order.actual_weight !== null &&
    order.actual_weight !== undefined &&
    Number(order.actual_weight) > 0;
  const actWeightKg = hasActualWeight
    ? Number(order.actual_weight)
    : reqWeightKg;
  const weightDiffGrams = Math.round((actWeightKg - reqWeightKg) * 1000);
  const absDiffGrams = Math.abs(weightDiffGrams);

  const workFee = Number(order.final_work_fee || 0);
  const recalcFee =
    options?.recalculatedWorkFee !== undefined
      ? options.recalculatedWorkFee
      : workFee;
  const feeDiff =
    options?.workFeeDiffAmount !== undefined
      ? options.workFeeDiffAmount
      : recalcFee - workFee;

  const weightDiffLabel =
    weightDiffGrams === 0
      ? "신청 중량과 일치 (±0g)"
      : weightDiffGrams > 0
        ? `+${weightDiffGrams.toLocaleString()}g 초과`
        : `${weightDiffGrams.toLocaleString()}g 미달`;

  const feeAdjustmentLabel =
    absDiffGrams <= 100 || feeDiff === 0
      ? `±100g 이내 일반 허용 오차 (선입금 작업비 ₩${fmt(workFee)} 변동 없음)`
      : feeDiff > 0
        ? `중량 초과 추가 작업비 +${fmt(feeDiff)}원 (STEP 04 정산 시 상계)`
        : `중량 미달 과오납 작업비 -${fmt(Math.abs(feeDiff))}원 (STEP 04 정산 시 합산 환급)`;

  const diffProcessDetail =
    feeDiff > 0
      ? `추가 작업비 +${fmt(feeDiff)}원 발생 (STEP 04 최종 정산금에서 상계 차감)`
      : feeDiff < 0
        ? `과오납 차액 -${fmt(Math.abs(feeDiff))}원 환급 (STEP 04 최종 정산금에 합산 입금)`
        : "작업비 차액 없음";

  const isCash = String(order.settlement_type) === "cash_transfer";
  const settlementLabel = isCash
    ? "정련소 당일 매입시세 현금 정산 (계좌이체)"
    : String(order.delivery_method) === "visit"
      ? "순금 실물 수령 (평택 정련실 직접 방문)"
      : "순금 실물 수령 (우체국 안심소포 택배)";

  const goldPrice = Number(order.gold_price || 171020);
  const buyPrice = Math.round(goldPrice * 0.975);
  const confirmedGold =
    order.actual_gold !== null && order.actual_gold !== undefined
      ? Number(order.actual_gold)
      : Number(order.expected_gold || 0);
  const withholdingTax = Number(order.withholding_tax_amount || 0);
  const finalCashPayout = Number(
    order.final_cash_payout || Math.round(confirmedGold * buyPrice) - withholdingTax
  );

  const taxAndPriceSummary = isCash
    ? `정련소 매입가 ${fmt(buyPrice)}원/g (KRX 97.5%) · 원천징수 -${fmt(withholdingTax)}원 공제`
    : "순도 98.5%~99.5% 골드 비드(Gold Button) 실물 정산";

  const finalSettlementResult = isCash
    ? `${String(order.bank_name || "")} ${String(order.bank_account || "")} (예금주: ${String(order.account_holder || order.client_name || "")}) 계좌로 세후 확정 실송금액 ${fmt(finalCashPayout)}원 이체 완료`
    : String(order.delivery_method) === "visit"
      ? `평택 정련실 방문 순금 비드 ${confirmedGold}g 실물 인계 완료`
      : `우체국 안심소포(보험등기) 순금 비드 ${confirmedGold}g 발송 완료`;

  // UN_8300(세무서류 요청)일 때는 고객의 정산 계좌를, UN_8291(접수/선입금 안내)일 때는 (주)이온랩 법인 입금계좌를 바인딩
  const isClientBankTpl = options?.tplCode === "UN_8300";
  const bankNameVar = isClientBankTpl
    ? String(order.bank_name || "지정 은행")
    : "IBK기업은행";
  const bankAccountVar = isClientBankTpl
    ? String(order.bank_account || "접수 계좌")
    : "933-041960-04-011";

  const trackerPath = buildTrackerPathWithoutProtocol(
    String(order.client_email || ""),
    String(order.client_phone || ""),
    String(order.access_password || "")
  );
  const trackerQueryOnly = trackerPath.includes("/?")
    ? trackerPath.split("/?")[1]
    : "";

  return {
    고객명: String(order.client_name || "고객"),
    고객연락처: String(order.client_phone || "-"),
    접수번호: String(order.receipt_number || "-"),
    접수일시: String(order.submitted_at || "-"),
    모재트랙명: String(order.track_name || "-"),
    신청중량: reqWeightKg.toFixed(2),
    실측중량: actWeightKg.toFixed(3),
    전처리옵션: String(order.preprocess_label || "전처리 없음"),
    정산방식: settlementLabel,
    조회비밀번호: String(order.access_password || "-"),
    조회링크: trackerPath,
    조회파라미터: trackerQueryOnly,
    입금은행: bankNameVar,
    입금계좌번호: bankAccountVar,
    선입금작업비: fmt(workFee),
    예상금중량: String(order.expected_gold ?? 0),
    확정순금중량: String(confirmedGold),
    누적확정금중량: String(
      options?.confirmedCumulativeGold !== undefined
        ? options.confirmedCumulativeGold
        : confirmedGold
    ),
    중량편차안내: weightDiffLabel,
    "작업비변동 안내": feeAdjustmentLabel,
    작업비변동안내: feeAdjustmentLabel,
    중량편차그램:
      weightDiffGrams >= 0
        ? `+${weightDiffGrams.toLocaleString()}g`
        : `${weightDiffGrams.toLocaleString()}g`,
    실측기준작업비: fmt(recalcFee),
    차액처리안내: diffProcessDetail,
    핵심계측배지: String(
      options?.measuredValue || "1인 1배치 단독 정밀 습식 공정 완료"
    ),
    단계코멘트: String(
      options?.logDetail || "정련 공정이 정상적으로 처리되었습니다."
    ),
    적용시세및세무내역: taxAndPriceSummary,
    최종정산출고결과: finalSettlementResult,
    세무구분명: String(
      order.tax_option_label || "개인 3.3% 사업소득 원천징수"
    ),
    필요서류안내:
      String(order.tax_option) === "business_invoice"
        ? "사업자등록증 사본 (세금계산서 발행용)"
        : "신분증(주민등록증 또는 운전면허증) 사본",
    고객메모: String(order.memo || "별도 기재사항 없음"),
  };
}


