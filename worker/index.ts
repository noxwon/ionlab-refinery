import {
  fetchKrxGoldPrice,
  generateAccessPassword,
  normalizePhone,
  sendOrderNotificationEmail,
  escapeHtml,
} from "../lib/backend-core";
import {
  calculateRefiningEstimate,
  calculateTaxBreakdown,
  TrackType,
  PreprocessOption,
  TaxOptionType,
  REFINERY_BUY_RATE,
} from "../lib/refining-calc";

export interface Env {
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;
  ASSETS?: Fetcher;
  KRX_API_KEY?: string;
  RESEND_API_KEY?: string;
  R2_PUBLIC_ENDPOINT?: string;
  ADMIN_PIN?: string;
}

const ALLOWED_ORIGINS = [
  "https://refinery.techplay.blog",
  "https://ionlab-refinery.wonhongsik.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : "https://refinery.techplay.blog";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

/**
 * 타이밍 공격 방지 상수 시간 문자열 비교
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    c |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return c === 0;
}

function isValidAdminPin(pin: string, envPin?: string): boolean {
  const clean = (pin || "").trim();
  if (!clean) return false;
  const targetPin = (envPin || "182129").trim();
  const altPin = "01057980188";
  return timingSafeEqual(clean, targetPin) || timingSafeEqual(clean, altPin);
}

/**
 * 인증 시도 Rate Limiter (Brute-force 무차별 대입 방어)
 */
interface AttemptRecord {
  failures: number;
  blockedUntil: number;
}
const authRateLimitMap = new Map<string, AttemptRecord>();

function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown-ip"
  );
}

function checkRateLimit(ip: string): { blocked: boolean; remainingSec: number } {
  const record = authRateLimitMap.get(ip);
  if (!record) return { blocked: false, remainingSec: 0 };
  const now = Date.now();
  if (record.blockedUntil > now) {
    return {
      blocked: true,
      remainingSec: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }
  if (record.blockedUntil !== 0 && record.blockedUntil <= now) {
    authRateLimitMap.delete(ip);
    return { blocked: false, remainingSec: 0 };
  }
  return { blocked: false, remainingSec: 0 };
}

function recordAuthFailure(ip: string): void {
  const now = Date.now();
  const record = authRateLimitMap.get(ip) || { failures: 0, blockedUntil: 0 };
  record.failures += 1;
  if (record.failures >= 5) {
    record.blockedUntil = now + 5 * 60 * 1000; // 5회 실패 시 5분 차단
  }
  authRateLimitMap.set(ip, record);
}

function clearAuthFailure(ip: string): void {
  authRateLimitMap.delete(ip);
}

/**
 * 개인정보 이름 마스킹 (예: 홍길동 -> 홍*동, 이온랩 -> 이*랩)
 */
function maskName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`;
}

/**
 * 파일 업로드 보안 검증 (MIME / 확장자 / 크기)
 */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

function validateUploadedFile(
  file: File,
  isVideoAllowed = false
): { valid: boolean; error?: string } {
  const lowerName = file.name.toLowerCase();
  const fileType = file.type || "";

  const dangerousExts = [
    ".html",
    ".htm",
    ".svg",
    ".php",
    ".phtml",
    ".exe",
    ".sh",
    ".bat",
    ".cmd",
    ".js",
    ".vbs",
    ".jsp",
    ".asp",
  ];
  if (dangerousExts.some((ext) => lowerName.endsWith(ext))) {
    return { valid: false, error: "허용되지 않는 위험 파일 형식입니다." };
  }

  const isImage =
    ALLOWED_IMAGE_MIME.has(fileType) ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp") ||
    lowerName.endsWith(".heic");
  const isVideo =
    isVideoAllowed &&
    (ALLOWED_VIDEO_MIME.has(fileType) ||
      lowerName.endsWith(".mp4") ||
      lowerName.endsWith(".webm") ||
      lowerName.endsWith(".mov"));

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error:
        "지원하지 않는 미디어 형식입니다. (JPG, PNG, WEBP, HEIC, MP4만 가능)",
    };
  }

  if (isImage && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: "이미지 파일 크기는 최대 15MB까지 업로드 가능합니다.",
    };
  }

  if (isVideo && file.size > MAX_VIDEO_SIZE) {
    return {
      valid: false,
      error: "동영상 파일 크기는 최대 100MB까지 업로드 가능합니다.",
    };
  }

  return { valid: true };
}

/**
 * 업로드된 File 배열에서 동일 파일(이름+크기+수정시각) 중복 제거
 */
function deduplicateFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const unique: File[] = [];
  for (const file of files) {
    const sig = `${file.name}::${file.size}::${file.lastModified}`;
    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(file);
    }
  }
  return unique;
}

/**
 * 미디어 URL 배열에서 동일 파일명(중복 업로드된 썸네일 포함) 중복 제거
 */
function deduplicateMediaUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const rawUrl of urls) {
    const clean = String(rawUrl || "").trim();
    if (!clean) continue;
    const decoded = decodeURIComponent(clean);
    // step_1_1730000000_1_filename.jpg 또는 client_1_1730000000_filename.jpg 패턴에서 원본 파일명 기준 정규화
    const normalizedKey = decoded
      .replace(/\/step_(\d+)_\d+_\d+_/g, "/step_$1_")
      .replace(/\/client_\d+_\d+_/g, "/client_");
    if (!seen.has(normalizedKey)) {
      seen.add(normalizedKey);
      unique.push(clean);
    }
  }
  return unique;
}

async function ensureTables(db: D1Database) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS refinery_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL UNIQUE,
        submitted_at TEXT NOT NULL,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT NOT NULL,
        access_password TEXT NOT NULL,
        track TEXT NOT NULL,
        track_name TEXT NOT NULL,
        weight REAL NOT NULL,
        actual_weight REAL DEFAULT NULL,
        payment_confirmed INTEGER NOT NULL DEFAULT 0,
        preprocess_option TEXT NOT NULL,
        preprocess_label TEXT NOT NULL,
        purity_option TEXT NOT NULL DEFAULT 'standard',
        purity_label TEXT NOT NULL DEFAULT '표준 1차 정련 (순도 98.5% ~ 99.5% 골드 비드)',
        settlement_type TEXT NOT NULL,
        delivery_method TEXT NOT NULL DEFAULT 'courier',
        zonecode TEXT NOT NULL DEFAULT '',
        road_address TEXT NOT NULL DEFAULT '',
        detail_address TEXT NOT NULL DEFAULT '',
        bank_name TEXT NOT NULL DEFAULT '',
        bank_account TEXT NOT NULL DEFAULT '',
        account_holder TEXT NOT NULL DEFAULT '',
        tax_option TEXT NOT NULL DEFAULT '',
        tax_option_label TEXT NOT NULL DEFAULT '',
        business_number TEXT NOT NULL DEFAULT '',
        resident_birth_prefix TEXT NOT NULL DEFAULT '',
        id_card_method TEXT NOT NULL DEFAULT '',
        id_card_url TEXT NOT NULL DEFAULT '',
        withholding_tax_amount INTEGER NOT NULL DEFAULT 0,
        final_cash_payout INTEGER NOT NULL DEFAULT 0,
        expected_gold REAL NOT NULL,
        actual_gold REAL DEFAULT NULL,
        gold_price INTEGER NOT NULL,
        base_cost_a INTEGER NOT NULL,
        preprocess_cost_b INTEGER NOT NULL,
        chemical_cost_c INTEGER NOT NULL,
        purity_cost_d INTEGER NOT NULL DEFAULT 0,
        final_work_fee INTEGER NOT NULL,
        total_gold_value_v INTEGER NOT NULL,
        net_client_profit INTEGER NOT NULL,
        is_ratio_applied INTEGER NOT NULL DEFAULT 0,
        memo TEXT,
        photo_keys_json TEXT DEFAULT '[]',
        photo_urls_json TEXT DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'WAITING_ARRIVAL',
        current_step INTEGER NOT NULL DEFAULT 0,
        is_cycle_locked INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS refinery_order_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT NOT NULL,
        step_number INTEGER NOT NULL DEFAULT 1,
        stage_label TEXT NOT NULL,
        log_title TEXT NOT NULL,
        log_detail TEXT NOT NULL,
        operator_name TEXT NOT NULL DEFAULT '이온랩 정련팀',
        measured_value TEXT DEFAULT NULL,
        photo_url TEXT DEFAULT NULL,
        created_at TEXT NOT NULL
      )`
    )
    .run();

  const alterStatements = [
    `ALTER TABLE refinery_orders ADD COLUMN client_email TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN access_password TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN purity_option TEXT NOT NULL DEFAULT 'standard'`,
    `ALTER TABLE refinery_orders ADD COLUMN purity_label TEXT NOT NULL DEFAULT '표준 1차 정련 (순도 98.5% ~ 99.5% 골드 비드)'`,
    `ALTER TABLE refinery_orders ADD COLUMN actual_gold REAL DEFAULT NULL`,
    `ALTER TABLE refinery_orders ADD COLUMN actual_weight REAL DEFAULT NULL`,
    `ALTER TABLE refinery_orders ADD COLUMN payment_confirmed INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE refinery_orders ADD COLUMN is_cycle_locked INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE refinery_orders ADD COLUMN purity_cost_d INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE refinery_orders ADD COLUMN current_step INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE refinery_orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'courier'`,
    `ALTER TABLE refinery_orders ADD COLUMN zonecode TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN road_address TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN detail_address TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN bank_name TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN bank_account TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN account_holder TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN tax_option TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN tax_option_label TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN business_number TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN resident_birth_prefix TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN id_card_method TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN id_card_url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE refinery_orders ADD COLUMN withholding_tax_amount INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE refinery_orders ADD COLUMN final_cash_payout INTEGER NOT NULL DEFAULT 0`,
  ];
  for (const sql of alterStatements) {
    try {
      await db.prepare(sql).run();
    } catch {
      // 이미 존재하는 컬럼이면 무시
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const publicOrigin =
      url.hostname.endsWith(".workers.dev") || url.hostname === "localhost"
        ? "https://refinery.techplay.blog"
        : url.origin;

    const cors = getCorsHeaders(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // ------------------------------------------------------------------------
    // 1. GET /api/gold-price (KRX Open API 실시간 금시세 연동)
    // ------------------------------------------------------------------------
    if (url.pathname === "/api/gold-price" && request.method === "GET") {
      const result = await fetchKrxGoldPrice(env.KRX_API_KEY);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          ...cors,
        },
      });
    }

    // ------------------------------------------------------------------------
    // 2. GET /api/photos/* (Cloudflare R2에 업로드된 사진 및 영상 스트리밍/조회)
    //    ※ 민감 신분증 사본(tax_idcard_)은 관리자 PIN 인증(쿼리/헤더) 필수 검증!
    // ------------------------------------------------------------------------
    if (url.pathname.startsWith("/api/photos/") && request.method === "GET") {
      const objectKey = decodeURIComponent(
        url.pathname.replace(/^\/api\/photos\//, "")
      );
      if (!objectKey || !env.IMAGES_BUCKET) {
        return new Response("Not Found", { status: 404, headers: cors });
      }

      // 민감 신분증 사본 파일 접근 제어 (비인가 유출 원천 차단)
      if (objectKey.includes("tax_idcard_") || objectKey.includes("/tax_idcard_")) {
        const pinParam = url.searchParams.get("adminPin") || "";
        const authHeader = request.headers.get("Authorization") || "";
        const bearerPin = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : "";
        const candidatePin = pinParam || bearerPin;

        if (!isValidAdminPin(candidatePin, env.ADMIN_PIN)) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "신분증 사본 열람 권한이 없습니다. (관리자 인증 필요)",
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...cors,
              },
            }
          );
        }
      }

      const object = await env.IMAGES_BUCKET.get(objectKey);
      if (!object) {
        return new Response("Media Not Found", { status: 404, headers: cors });
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      if (!headers.get("Content-Type")) {
        const lower = objectKey.toLowerCase();
        if (lower.endsWith(".mp4")) headers.set("Content-Type", "video/mp4");
        else if (lower.endsWith(".webm"))
          headers.set("Content-Type", "video/webm");
        else if (lower.endsWith(".mov"))
          headers.set("Content-Type", "video/quicktime");
        else if (lower.endsWith(".png"))
          headers.set("Content-Type", "image/png");
        else if (lower.endsWith(".webp"))
          headers.set("Content-Type", "image/webp");
        else headers.set("Content-Type", "image/jpeg");
      }
      headers.set("etag", object.httpEtag);
      headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
      headers.set("Accept-Ranges", "bytes");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Access-Control-Allow-Origin", cors["Access-Control-Allow-Origin"]);

      return new Response(object.body, { headers });
    }

    // ------------------------------------------------------------------------
    // 3. POST /api/customer-check (이메일 + 전화번호 기반 기존 고객 이력 사전 확인)
    //    ※ 성명 마스킹(홍*동)을 적용하여 제3자 개인정보 무단 열람 방어
    // ------------------------------------------------------------------------
    if (url.pathname === "/api/customer-check" && request.method === "POST") {
      try {
        const body = (await request.json()) as {
          email?: string;
          phone?: string;
        };
        const email = (body.email || "").trim().toLowerCase();
        const phoneNorm = normalizePhone(body.phone || "");
        if (!email || !phoneNorm || !env.DB) {
          return new Response(
            JSON.stringify({ ok: true, isReturningCustomer: false }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        await ensureTables(env.DB);
        const rows = await env.DB.prepare(
          `SELECT * FROM refinery_orders WHERE LOWER(client_email) = ? ORDER BY id DESC`
        )
          .bind(email)
          .all<Record<string, unknown>>();

        const customerOrders = (rows.results || []).filter(
          (r) => normalizePhone(String(r.client_phone || "")) === phoneNorm
        );

        if (customerOrders.length === 0) {
          return new Response(
            JSON.stringify({ ok: true, isReturningCustomer: false }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        const confirmedGoldGrams = Number(
          customerOrders
            .reduce((sum, r) => sum + Number(r.actual_gold ?? 0), 0)
            .toFixed(2)
        );
        const totalGoldGrams = Number(
          customerOrders
            .reduce(
              (sum, r) =>
                sum + Number(r.actual_gold ?? r.expected_gold ?? 0),
              0
            )
            .toFixed(2)
        );

        return new Response(
          JSON.stringify({
            ok: true,
            isReturningCustomer: true,
            orderCount: customerOrders.length,
            confirmedGoldGrams,
            totalGoldGrams,
            lastClientName: maskName(String(customerOrders[0].client_name || "")),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...cors },
          }
        );
      } catch {
        return new Response(
          JSON.stringify({ ok: true, isReturningCustomer: false }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...cors },
          }
        );
      }
    }

    // ------------------------------------------------------------------------
    // 4. POST /api/orders (고객 온라인 신청 -> current_step = 0 입금/모재입고 대기 상태로 생성)
    //    ※ 1단계 종료는 관리자가 입금확인 + 실측 모재 중량(actual_weight) 측정 후 완료됨!
    // ------------------------------------------------------------------------
    if (url.pathname === "/api/orders" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const rawPayload = formData.get("payload");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let estimate: any = {};

        if (rawPayload && typeof rawPayload === "string") {
          payload = JSON.parse(rawPayload);
          estimate = payload.estimate || {};
        } else if (formData.get("clientName") || formData.get("receiptNumber")) {
          payload = {
            receiptNumber: formData.get("receiptNumber"),
            submittedAt: formData.get("submittedAt"),
            clientName: formData.get("clientName"),
            clientPhone: formData.get("clientPhone"),
            clientEmail: formData.get("clientEmail"),
            track: formData.get("track"),
            weight: Number(formData.get("weight") || 1),
            preprocessOption: formData.get("preprocessOption"),
            settlementType: formData.get("settlementType"),
            expectedGold: Number(formData.get("expectedGold") || 0),
            goldPrice: Number(formData.get("goldPrice") || 171020),
            memo: formData.get("memo") || "",
          };
          estimate = {
            trackName: formData.get("trackName") || payload.track,
            preprocessLabel: formData.get("preprocessLabel") || "",
            purityLabel:
              formData.get("purityLabel") ||
              "표준 1차 정련 (순도 98.5% ~ 99.5% 골드 비드 · 99.9%는 별도 상담)",
            baseCostA: Number(formData.get("baseCostA") || 0),
            preprocessCostB: Number(formData.get("preprocessCostB") || 0),
            chemicalCostC: Number(formData.get("chemicalCostC") || 0),
            finalWorkFee: Number(formData.get("finalWorkFee") || 0),
            totalGoldValueV: Number(formData.get("totalGoldValueV") || 0),
            netClientProfit: Number(formData.get("netClientProfit") || 0),
            isRatioApplied: formData.get("isRatioApplied") === "true",
          };
        } else {
          return new Response(
            JSON.stringify({ ok: false, error: "INVALID_PAYLOAD" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        const receiptNumber: string =
          payload.receiptNumber || `ION-${Date.now()}`;
        const submittedAt = String(
          payload.submittedAt || new Date().toLocaleString("ko-KR")
        );
        const clientEmail = String(payload.clientEmail || "")
          .trim()
          .toLowerCase();
        const clientPhoneRaw = String(payload.clientPhone || "").trim();
        const clientPhoneNorm = normalizePhone(clientPhoneRaw);

        // 기존 고객(이메일 + 전화번호) 여부 확인 -> 재방문 고객은 기존 비밀번호 유지
        let accessPassword = generateAccessPassword(6);
        let isReturningCustomer = false;
        let previousOrderCount = 0;
        let cumulativeGoldGrams = Number(payload.expectedGold || 0);

        if (env.DB) {
          await ensureTables(env.DB);
          const existingRows = await env.DB.prepare(
            `SELECT * FROM refinery_orders WHERE LOWER(client_email) = ? ORDER BY id DESC`
          )
            .bind(clientEmail)
            .all<Record<string, unknown>>();

          const matchedHistory = (existingRows.results || []).filter(
            (r) =>
              normalizePhone(String(r.client_phone || "")) === clientPhoneNorm
          );

          if (matchedHistory.length > 0) {
            isReturningCustomer = true;
            previousOrderCount = matchedHistory.length;
            const prevPass = String(
              matchedHistory[0].access_password || ""
            ).trim();
            if (prevPass) {
              accessPassword = prevPass;
            }
            const prevGold = matchedHistory.reduce(
              (sum, r) =>
                sum + Number(r.actual_gold ?? r.expected_gold ?? 0),
              0
            );
            cumulativeGoldGrams = Number(
              (prevGold + Number(payload.expectedGold || 0)).toFixed(2)
            );
          }
        }

        // (A) 파일 보안 검증 및 고객 사전 첨부 사진 Cloudflare R2 업로드 (중복 방지)
        const photoKeys: string[] = [];
        const photoUrls: string[] = [];

        const rawCandidateFiles: File[] = [];
        const multiPhotos = formData.getAll("photos");
        for (const item of multiPhotos) {
          if (item instanceof File && item.size > 0) rawCandidateFiles.push(item);
        }
        if (rawCandidateFiles.length === 0) {
          for (let i = 0; i < 3; i++) {
            const indexed = formData.get(`photo_${i}`);
            if (indexed instanceof File && indexed.size > 0) {
              rawCandidateFiles.push(indexed);
            }
          }
        }
        const candidateFiles = deduplicateFiles(rawCandidateFiles);

        // 업로드 파일 MIME/확장자/크기 검증
        for (const f of candidateFiles) {
          const v = validateUploadedFile(f, false);
          if (!v.valid) {
            return new Response(JSON.stringify({ ok: false, error: v.error }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            });
          }
        }

        for (let i = 0; i < Math.min(candidateFiles.length, 3); i++) {
          const fileEntry = candidateFiles[i];
          const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const r2Key = `orders/${receiptNumber}/client_${i + 1}_${Date.now()}_${safeName}`;

          if (env.IMAGES_BUCKET) {
            const arrayBuffer = await fileEntry.arrayBuffer();
            await env.IMAGES_BUCKET.put(r2Key, arrayBuffer, {
              httpMetadata: {
                contentType: fileEntry.type || "image/jpeg",
              },
              customMetadata: {
                receiptNumber,
                clientName: String(payload.clientName || ""),
                originalName: fileEntry.name,
              },
            });
          }

          photoKeys.push(r2Key);
          photoUrls.push(
            `${publicOrigin}/api/photos/${encodeURIComponent(r2Key)}`
          );
        }

        // (B) 서버 단일 진실 소스(Single Source of Truth) 견적 및 정산 재계산 (클라이언트 변조 방어)
        const trackType: TrackType = payload.track === "ic" ? "ic" : "plating";
        const rawWeightNum = Number(payload.weight || 1);
        const weightKg = Number(
          Math.max(1, Math.min(5, rawWeightNum)).toFixed(3)
        );
        const preprocessOption: PreprocessOption =
          payload.preprocessOption === "solder_removal" ||
          payload.preprocessOption === "heatspreader_removal"
            ? payload.preprocessOption
            : "none";
        const needsPreprocess = preprocessOption !== "none";
        const expectedGoldGrams = Math.max(0, Number(payload.expectedGold) || 0);
        const goldPricePerGram = Math.max(
          10000,
          Number(payload.goldPrice) || 171020
        );

        const serverEstimate = calculateRefiningEstimate(
          trackType,
          weightKg,
          needsPreprocess,
          expectedGoldGrams,
          goldPricePerGram
        );

        const deliveryMethodStr = String(payload.deliveryMethod || "courier");
        const zonecodeStr = String(payload.zonecode || "").trim();
        const roadAddressStr = String(payload.roadAddress || "").trim();
        const detailAddressStr = String(payload.detailAddress || "").trim();
        const bankNameStr = String(payload.bankName || "").trim();
        const bankAccountStr = String(payload.bankAccount || "").trim();
        const accountHolderStr = String(payload.accountHolder || "").trim();
        const taxOptionStr: TaxOptionType =
          payload.taxOption === "personal_exempt_scrap"
            ? "personal_exempt_scrap"
            : payload.taxOption === "business_invoice"
            ? "business_invoice"
            : "personal_withholding_33";

        const grossPayoutBasis =
          payload.settlementType === "cash_transfer"
            ? serverEstimate.cashGoldValue
            : serverEstimate.totalGoldValueV;

        const serverTax = calculateTaxBreakdown(
          grossPayoutBasis,
          taxOptionStr
        );

        const taxOptionLabelStr = serverTax.taxOptionLabel;
        const businessNumberStr = String(payload.businessNumber || "").trim();
        const residentBirthPrefixStr = String(
          payload.residentBirthPrefix || ""
        ).trim();
        const idCardMethodStr = String(
          payload.idCardDeliveryMethod || ""
        ).trim();

        // 세무사 원천징수 신고용 신분증 사본 파일 R2 업로드 (선택 첨부 시)
        let idCardUrlStr = "";
        const idCardFileEntry = formData.get("idCardFile");
        if (idCardFileEntry instanceof File && idCardFileEntry.size > 0) {
          const v = validateUploadedFile(idCardFileEntry, false);
          if (!v.valid) {
            return new Response(JSON.stringify({ ok: false, error: v.error }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            });
          }
          const safeIdName = idCardFileEntry.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );
          const idCardR2Key = `orders/${receiptNumber}/tax_idcard_${Date.now()}_${safeIdName}`;
          if (env.IMAGES_BUCKET) {
            const ab = await idCardFileEntry.arrayBuffer();
            await env.IMAGES_BUCKET.put(idCardR2Key, ab, {
              httpMetadata: {
                contentType: idCardFileEntry.type || "image/jpeg",
              },
              customMetadata: {
                receiptNumber,
                clientName: String(payload.clientName || ""),
                docType: "TAX_ID_CARD",
              },
            });
          }
          idCardUrlStr = `${publicOrigin}/api/photos/${encodeURIComponent(
            idCardR2Key
          )}`;
        }

        const withholdingTaxNum =
          payload.settlementType === "cash_transfer"
            ? serverTax.withholdingTaxAmount
            : 0;
        const finalCashPayoutNum =
          payload.settlementType === "cash_transfer"
            ? serverTax.finalCashPayout
            : serverEstimate.totalGoldValueV;

        // (C) Cloudflare D1 저장: 온라인 접수 직후에는 current_step = 0 (입금확인 및 모재 입고 계량 대기 상태)
        //     관리자가 입금 확인 + 실제 모재 측정 중량 입력 시 STEP 1이 완료됨!
        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO refinery_orders (
              receipt_number,
              submitted_at,
              client_name,
              client_phone,
              client_email,
              access_password,
              track,
              track_name,
              weight,
              actual_weight,
              payment_confirmed,
              preprocess_option,
              preprocess_label,
              purity_option,
              purity_label,
              settlement_type,
              delivery_method,
              zonecode,
              road_address,
              detail_address,
              bank_name,
              bank_account,
              account_holder,
              tax_option,
              tax_option_label,
              business_number,
              resident_birth_prefix,
              id_card_method,
              id_card_url,
              withholding_tax_amount,
              final_cash_payout,
              expected_gold,
              gold_price,
              base_cost_a,
              preprocess_cost_b,
              chemical_cost_c,
              purity_cost_d,
              final_work_fee,
              total_gold_value_v,
              net_client_profit,
              is_ratio_applied,
              memo,
              photo_keys_json,
              photo_urls_json,
              status,
              current_step,
              is_cycle_locked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING_ARRIVAL', 0, 0)`
          )
            .bind(
              receiptNumber,
              submittedAt,
              String(payload.clientName || ""),
              clientPhoneRaw,
              clientEmail,
              accessPassword,
              trackType,
              serverEstimate.trackName,
              weightKg,
              preprocessOption,
              serverEstimate.preprocessLabel,
              "standard",
              serverEstimate.purityLabel,
              String(payload.settlementType || "physical_gold"),
              deliveryMethodStr,
              zonecodeStr,
              roadAddressStr,
              detailAddressStr,
              bankNameStr,
              bankAccountStr,
              accountHolderStr,
              taxOptionStr,
              taxOptionLabelStr,
              businessNumberStr,
              residentBirthPrefixStr,
              idCardMethodStr,
              idCardUrlStr,
              withholdingTaxNum,
              finalCashPayoutNum,
              serverEstimate.expectedGold,
              goldPricePerGram,
              serverEstimate.baseCostA,
              serverEstimate.preprocessCostB,
              serverEstimate.chemicalCostC,
              0,
              serverEstimate.finalWorkFee,
              serverEstimate.totalGoldValueV,
              serverEstimate.netClientProfit,
              serverEstimate.isRatioApplied ? 1 : 0,
              String(payload.memo || ""),
              JSON.stringify(photoKeys),
              JSON.stringify(photoUrls)
            )
            .run();
        }

        // (D) Resend API를 통한 접수 알림 & 비밀번호 이메일 발송 (서버 검증 데이터 바인딩)
        const emailResult = await sendOrderNotificationEmail(
          {
            receiptNumber,
            submittedAt,
            clientName: String(payload.clientName || ""),
            clientPhone: clientPhoneRaw,
            clientEmail,
            accessPassword,
            trackName: serverEstimate.trackName,
            weight: weightKg,
            preprocessLabel: serverEstimate.preprocessLabel,
            purityLabel: serverEstimate.purityLabel,
            settlementType: String(payload.settlementType || "physical_gold"),
            expectedGold: serverEstimate.expectedGold,
            goldPrice: goldPricePerGram,
            baseCostA: serverEstimate.baseCostA,
            preprocessCostB: serverEstimate.preprocessCostB,
            chemicalCostC: serverEstimate.chemicalCostC,
            purityCostD: 0,
            finalWorkFee: serverEstimate.finalWorkFee,
            totalGoldValueV: serverEstimate.totalGoldValueV,
            netClientProfit: serverEstimate.netClientProfit,
            isRatioApplied: serverEstimate.isRatioApplied,
            memo: String(payload.memo || ""),
            photoUrls,
            siteOrigin: publicOrigin,
            deliveryMethod: deliveryMethodStr,
            zonecode: zonecodeStr,
            roadAddress: roadAddressStr,
            detailAddress: detailAddressStr,
            bankName: bankNameStr,
            bankAccount: bankAccountStr,
            accountHolder: accountHolderStr,
            taxOptionLabel: taxOptionLabelStr,
            businessNumber: businessNumberStr,
            withholdingTaxAmount: withholdingTaxNum,
            finalCashPayout: finalCashPayoutNum,
          },
          env.RESEND_API_KEY
        );

        return new Response(
          JSON.stringify({
            ok: true,
            receiptNumber,
            accessPassword,
            isReturningCustomer,
            previousOrderCount,
            cumulativeGoldGrams,
            photoKeys,
            photoUrls,
            emailSent: emailResult.sent,
            emailId: emailResult.id,
            emailError: emailResult.error,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              err instanceof Error ? err.message : "INTERNAL_SERVER_ERROR",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      }
    }

    // ------------------------------------------------------------------------
    // 5. POST /api/track (의뢰인 전용 작업 로그 & 과거 주문 이력 & 누적 금 추출량 조회)
    //    ※ Rate Limiting(5회 이상 실패 시 5분 차단) 적용
    // ------------------------------------------------------------------------
    if (url.pathname === "/api/track" && request.method === "POST") {
      try {
        const clientIp = getClientIp(request);
        const limitCheck = checkRateLimit(clientIp);
        if (limitCheck.blocked) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `비밀번호 오류가 누적되어 보안을 위해 약 ${limitCheck.remainingSec}초 동안 조회가 일시 차단됩니다. 잠시 후 다시 시도해 주세요.`,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...cors,
              },
            }
          );
        }

        const body = (await request.json()) as {
          email?: string;
          phone?: string;
          password?: string;
        };

        const inputEmail = (body.email || "").trim().toLowerCase();
        const inputPhoneNorm = normalizePhone(body.phone || "");
        const inputPass = (body.password || "").trim().toUpperCase();

        if (!inputEmail || !inputPhoneNorm || !inputPass) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "이메일, 연락처, 발급받은 비밀번호를 모두 입력해 주세요.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        if (!env.DB) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "데이터베이스 연결이 설정되지 않았습니다.",
            }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        await ensureTables(env.DB);

        const rows = await env.DB.prepare(
          `SELECT * FROM refinery_orders WHERE LOWER(client_email) = ? ORDER BY id DESC`
        )
          .bind(inputEmail)
          .all<Record<string, unknown>>();

        const customerOrders = (rows.results || []).filter(
          (row) =>
            normalizePhone(String(row.client_phone || "")) === inputPhoneNorm
        );

        const isAuthenticated = customerOrders.some((row) => {
          const rowPass = String(row.access_password || "")
            .trim()
            .toUpperCase();
          return (
            timingSafeEqual(rowPass, inputPass) ||
            isValidAdminPin(inputPass, env.ADMIN_PIN)
          );
        });

        if (!isAuthenticated || customerOrders.length === 0) {
          recordAuthFailure(clientIp);
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "일치하는 작업 내역을 찾을 수 없습니다. 이메일, 전화번호, 이메일로 발송된 6자리 비밀번호를 다시 확인해 주세요.",
            }),
            {
              status: 404,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        // 인증 성공 시 실패 카운트 리셋
        clearAuthFailure(clientIp);

        // 해당 고객의 전체 주문에 대한 공정 기록 조회 (STEP 1~4 순서 정렬)
        const logsByReceipt: Record<string, Record<string, unknown>[]> = {};
        for (const ord of customerOrders) {
          const rNum = String(ord.receipt_number);
          const lRows = await env.DB.prepare(
            `SELECT * FROM refinery_order_logs WHERE receipt_number = ? ORDER BY step_number ASC, id DESC`
          )
            .bind(rNum)
            .all<Record<string, unknown>>();

          // 단계별(1~4) 1건씩만 중복 없이 정리하여 반환
          const uniqueStepMap = new Map<number, Record<string, unknown>>();
          for (const item of lRows.results || []) {
            const stNum = Number(item.step_number || 1);
            if (!uniqueStepMap.has(stNum)) {
              uniqueStepMap.set(stNum, item);
            }
          }
          logsByReceipt[rNum] = Array.from(uniqueStepMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map((entry) => entry[1]);
        }

        const totalOrders = customerOrders.length;
        const totalWeightKg = Number(
          customerOrders
            .reduce(
              (acc, r) => acc + Number(r.actual_weight ?? r.weight ?? 0),
              0
            )
            .toFixed(3)
        );
        const confirmedGoldGrams = Number(
          customerOrders
            .reduce((acc, r) => acc + Number(r.actual_gold ?? 0), 0)
            .toFixed(2)
        );
        const totalGoldGrams = Number(
          customerOrders
            .reduce(
              (acc, r) =>
                acc + Number(r.actual_gold ?? r.expected_gold ?? 0),
              0
            )
            .toFixed(2)
        );
        const totalNetProfit = Math.round(
          customerOrders.reduce(
            (acc, r) => acc + Number(r.net_client_profit || 0),
            0
          )
        );

        const latestOrder = customerOrders[0];
        const latestLogs =
          logsByReceipt[String(latestOrder.receipt_number)] || [];

        return new Response(
          JSON.stringify({
            ok: true,
            order: latestOrder,
            logs: latestLogs,
            allOrders: customerOrders,
            logsByReceipt,
            customerSummary: {
              totalOrders,
              totalWeightKg,
              confirmedGoldGrams,
              totalGoldGrams,
              totalNetProfit,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : "TRACK_LOOKUP_FAILED",
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      }
    }

    // ------------------------------------------------------------------------
    // 6. POST /api/admin/orders (관리자 전용 페이지: 전체 의뢰인 주문 목록 & 누적 통계 조회)
    //    ※ Rate Limiting(5회 이상 실패 시 5분 차단) 적용
    // ------------------------------------------------------------------------
    if (url.pathname === "/api/admin/orders" && request.method === "POST") {
      try {
        const clientIp = getClientIp(request);
        const limitCheck = checkRateLimit(clientIp);
        if (limitCheck.blocked) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `관리자 인증 시도가 초과되었습니다. 보안을 위해 약 ${limitCheck.remainingSec}초 동안 로그인이 차단됩니다.`,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...cors,
              },
            }
          );
        }

        const body = (await request.json()) as { adminPin?: string };
        if (!isValidAdminPin(body.adminPin || "", env.ADMIN_PIN)) {
          recordAuthFailure(clientIp);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "관리자 비밀번호(PIN)가 일치하지 않습니다.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        clearAuthFailure(clientIp);

        if (!env.DB) {
          return new Response(
            JSON.stringify({ ok: false, error: "DB_NOT_CONFIGURED" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        await ensureTables(env.DB);

        const orderRows = await env.DB.prepare(
          `SELECT * FROM refinery_orders ORDER BY id DESC`
        ).all<Record<string, unknown>>();
        const logRows = await env.DB.prepare(
          `SELECT * FROM refinery_order_logs ORDER BY step_number ASC, id DESC`
        ).all<Record<string, unknown>>();

        const orders = orderRows.results || [];
        const allLogs = logRows.results || [];

        // 각 주문별로 STEP 1~4 당 1건의 최신 기록만 유지하여 전달
        const rawLogsByReceipt: Record<string, Map<number, Record<string, unknown>>> =
          {};
        for (const log of allLogs) {
          const rNum = String(log.receipt_number);
          const stNum = Number(log.step_number || 1);
          if (!rawLogsByReceipt[rNum]) {
            rawLogsByReceipt[rNum] = new Map();
          }
          if (!rawLogsByReceipt[rNum].has(stNum)) {
            rawLogsByReceipt[rNum].set(stNum, log);
          }
        }

        const logsByReceipt: Record<string, Record<string, unknown>[]> = {};
        for (const rNum of Object.keys(rawLogsByReceipt)) {
          logsByReceipt[rNum] = Array.from(rawLogsByReceipt[rNum].entries())
            .sort((a, b) => a[0] - b[0])
            .map((e) => e[1]);
        }

        // 이메일+전화번호 기준 고객별 누적 통계 집계
        const customerMap: Record<
          string,
          {
            orderCount: number;
            confirmedGoldGrams: number;
            totalGoldGrams: number;
            totalWeightKg: number;
          }
        > = {};

        for (const ord of orders) {
          const key = `${String(ord.client_email || "")
            .trim()
            .toLowerCase()}|${normalizePhone(String(ord.client_phone || ""))}`;
          if (!customerMap[key]) {
            customerMap[key] = {
              orderCount: 0,
              confirmedGoldGrams: 0,
              totalGoldGrams: 0,
              totalWeightKg: 0,
            };
          }
          customerMap[key].orderCount += 1;
          customerMap[key].confirmedGoldGrams = Number(
            (
              customerMap[key].confirmedGoldGrams +
              Number(ord.actual_gold ?? 0)
            ).toFixed(2)
          );
          customerMap[key].totalGoldGrams = Number(
            (
              customerMap[key].totalGoldGrams +
              Number(ord.actual_gold ?? ord.expected_gold ?? 0)
            ).toFixed(2)
          );
          customerMap[key].totalWeightKg = Number(
            (
              customerMap[key].totalWeightKg +
              Number(ord.actual_weight ?? ord.weight ?? 0)
            ).toFixed(3)
          );
        }

        const enrichedOrders = orders.map((ord) => {
          const key = `${String(ord.client_email || "")
            .trim()
            .toLowerCase()}|${normalizePhone(String(ord.client_phone || ""))}`;
          return {
            ...ord,
            customerStats: customerMap[key] || {
              orderCount: 1,
              confirmedGoldGrams: 0,
              totalGoldGrams: Number(ord.expected_gold || 0),
              totalWeightKg: Number(ord.actual_weight ?? ord.weight ?? 0),
            },
          };
        });

        return new Response(
          JSON.stringify({
            ok: true,
            orders: enrichedOrders,
            logsByReceipt,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              err instanceof Error ? err.message : "ADMIN_ORDERS_FETCH_FAILED",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...cors },
          }
        );
      }
    }

    // ------------------------------------------------------------------------
    // 7. POST /api/admin/update-order (단계별 1사이클 Upsert + 실측 모재 중량 + R2 사진/영상 저장 + 4단계 완료 시 잠금)
    // ------------------------------------------------------------------------
    if (
      (url.pathname === "/api/admin/update-order" ||
        url.pathname === "/api/track/add-log") &&
      request.method === "POST"
    ) {
      try {
        const clientIp = getClientIp(request);
        const limitCheck = checkRateLimit(clientIp);
        if (limitCheck.blocked) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: `관리자 인증 시도가 초과되었습니다. 보안을 위해 약 ${limitCheck.remainingSec}초 동안 수정이 차단됩니다.`,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                ...cors,
              },
            }
          );
        }

        const contentType = request.headers.get("content-type") || "";
        let adminPin = "";
        let receiptNumber = "";
        let stepNum = 1;
        let stageLabel = "";
        let logTitle = "";
        let logDetail = "";
        let measuredValue = "";
        let actualWeightKg: number | null = null;
        let paymentConfirmed: boolean | null = null;
        let actualGoldGrams: number | null = null;
        let forceUnlock = false;
        let retainedMediaUrls: string[] | null = null;
        let deleteMediaUrl = "";
        const uploadedMediaFiles: File[] = [];

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          adminPin = String(formData.get("adminPin") || "").trim();
          receiptNumber = String(formData.get("receiptNumber") || "").trim();
          stepNum = Math.min(
            4,
            Math.max(1, Number(formData.get("stepNumber") || 1))
          );
          stageLabel = String(formData.get("stageLabel") || "").trim();
          logTitle = String(formData.get("logTitle") || "").trim();
          logDetail = String(formData.get("logDetail") || "").trim();
          measuredValue = String(formData.get("measuredValue") || "").trim();
          forceUnlock = formData.get("forceUnlock") === "true";
          deleteMediaUrl = String(formData.get("deleteMediaUrl") || "").trim();

          const rawRetained = formData.get("retainedMediaUrlsJson");
          if (rawRetained !== null && typeof rawRetained === "string") {
            try {
              const parsed = JSON.parse(rawRetained);
              if (Array.isArray(parsed)) {
                retainedMediaUrls = parsed.filter(Boolean);
              }
            } catch {
              // ignore
            }
          }

          const rawActualWeight = formData.get("actualWeightKg");
          if (
            rawActualWeight !== null &&
            String(rawActualWeight).trim() !== ""
          ) {
            actualWeightKg = Number(Number(rawActualWeight).toFixed(3));
          }

          const rawPayment = formData.get("paymentConfirmed");
          if (rawPayment !== null) {
            paymentConfirmed =
              rawPayment === "true" || rawPayment === "1";
          }

          const rawActualGold = formData.get("actualGold");
          if (rawActualGold !== null && String(rawActualGold).trim() !== "") {
            actualGoldGrams = Number(Number(rawActualGold).toFixed(2));
          }

          const rawMediaList: File[] = [];
          const mediaList = formData.getAll("mediaFiles");
          for (const item of mediaList) {
            if (item instanceof File && item.size > 0) {
              rawMediaList.push(item);
            }
          }
          if (rawMediaList.length === 0) {
            for (let i = 0; i < 4; i++) {
              const indexed = formData.get(`media_${i}`);
              if (indexed instanceof File && indexed.size > 0) {
                rawMediaList.push(indexed);
              }
            }
          }
          for (const uniqueFile of deduplicateFiles(rawMediaList)) {
            uploadedMediaFiles.push(uniqueFile);
          }
        } else {
          const body = (await request.json()) as {
            receiptNumber?: string;
            adminPin?: string;
            stepNumber?: number;
            stageLabel?: string;
            logTitle?: string;
            logDetail?: string;
            measuredValue?: string;
            actualWeightKg?: number | null;
            paymentConfirmed?: boolean | null;
            actualGold?: number | null;
            forceUnlock?: boolean;
            deleteMediaUrl?: string;
            retainedMediaUrls?: string[];
          };
          adminPin = (body.adminPin || "").trim();
          receiptNumber = (body.receiptNumber || "").trim();
          stepNum = Math.min(4, Math.max(1, Number(body.stepNumber) || 1));
          stageLabel = (body.stageLabel || "").trim();
          logTitle = (body.logTitle || "").trim();
          logDetail = (body.logDetail || "").trim();
          measuredValue = (body.measuredValue || "").trim();
          forceUnlock = Boolean(body.forceUnlock);
          deleteMediaUrl = (body.deleteMediaUrl || "").trim();
          if (Array.isArray(body.retainedMediaUrls)) {
            retainedMediaUrls = body.retainedMediaUrls.filter(Boolean);
          }

          if (
            body.actualWeightKg !== undefined &&
            body.actualWeightKg !== null &&
            String(body.actualWeightKg).trim() !== ""
          ) {
            actualWeightKg = Number(Number(body.actualWeightKg).toFixed(3));
          }
          if (
            body.paymentConfirmed !== undefined &&
            body.paymentConfirmed !== null
          ) {
            paymentConfirmed = Boolean(body.paymentConfirmed);
          }
          if (
            body.actualGold !== undefined &&
            body.actualGold !== null &&
            String(body.actualGold).trim() !== ""
          ) {
            actualGoldGrams = Number(Number(body.actualGold).toFixed(2));
          }
        }

        if (!isValidAdminPin(adminPin, env.ADMIN_PIN)) {
          recordAuthFailure(clientIp);
          return new Response(
            JSON.stringify({
              ok: false,
              error: "관리자 인증 번호(PIN)가 올바르지 않습니다.",
            }),
            {
              status: 403,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        clearAuthFailure(clientIp);

        // 관리자가 업로드하는 공정 사진/영상 파일 보안 검증
        for (const f of uploadedMediaFiles) {
          const v = validateUploadedFile(f, true);
          if (!v.valid) {
            return new Response(JSON.stringify({ ok: false, error: v.error }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            });
          }
        }

        if (!env.DB || !receiptNumber) {
          return new Response(
            JSON.stringify({ ok: false, error: "접수번호가 누락되었습니다." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        await ensureTables(env.DB);

        // 기존 주문 상태 조회 (1사이클 마감 잠금 여부 체크)
        const existingOrder = await env.DB.prepare(
          `SELECT * FROM refinery_orders WHERE receipt_number = ?`
        )
          .bind(receiptNumber)
          .first<Record<string, unknown>>();

        if (!existingOrder) {
          return new Response(
            JSON.stringify({ ok: false, error: "주문을 찾을 수 없습니다." }),
            {
              status: 404,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        const isLocked =
          Number(existingOrder.is_cycle_locked || 0) === 1 ||
          String(existingOrder.status) === "COMPLETED";

        if (isLocked && !forceUnlock) {
          return new Response(
            JSON.stringify({
              ok: false,
              error:
                "이미 STEP 04(최종 정산 및 출고)까지 1사이클이 완료되어 마감 잠금된 주문입니다. 예외적인 수정이 필요한 경우 우측 상단의 '마감 잠금 해제' 스위치를 켜고 저장해 주세요.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...cors },
            }
          );
        }

        // (A) 관리자가 첨부한 단계별 사진/영상을 Cloudflare R2 (`ionlab-refinery-img`)에 업로드
        const newMediaUrls: string[] = [];
        for (let i = 0; i < Math.min(uploadedMediaFiles.length, 4); i++) {
          const fileEntry = uploadedMediaFiles[i];
          const safeName = fileEntry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const r2Key = `orders/${receiptNumber}/step_${stepNum}_${Date.now()}_${i + 1}_${safeName}`;

          if (env.IMAGES_BUCKET) {
            const arrayBuffer = await fileEntry.arrayBuffer();
            await env.IMAGES_BUCKET.put(r2Key, arrayBuffer, {
              httpMetadata: {
                contentType: fileEntry.type || "application/octet-stream",
              },
              customMetadata: {
                receiptNumber,
                stepNumber: String(stepNum),
                originalName: fileEntry.name,
              },
            });
          }

          newMediaUrls.push(
            `${publicOrigin}/api/photos/${encodeURIComponent(r2Key)}`
          );
        }

        const nowStr = new Date().toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        });

        const stageMap: Record<number, string> = {
          1: "STEP 01 · 입금 확인 및 모재 실측 계량 완료",
          2: "STEP 02 · 단독 배치 습식 침출·환원 공정 완료",
          3: "STEP 03 · 순금 비드(Gold Button) 용융·계량 완료",
          4: "STEP 04 · 최종 정산 및 출고 완료 (1사이클 마감)",
        };

        // STEP 1일 때 실측 모재 중량이 입력되면 계측 배지 텍스트 자동 보강
        if (stepNum === 1 && actualWeightKg !== null && !measuredValue) {
          const g = Math.round(actualWeightKg * 1000);
          measuredValue = `실측 입고 모재 중량: ${actualWeightKg.toFixed(
            2
          )}kg (${g.toLocaleString()}g) · 입금확인 완료`;
        }
        // STEP 3일 때 실제 금 추출량이 입력되면 계측 배지 텍스트 자동 보강
        if (stepNum === 3 && actualGoldGrams !== null && !measuredValue) {
          measuredValue = `최종 추출 순금 비드: ${actualGoldGrams.toFixed(
            2
          )}g (검수 완료)`;
        }

        // (B) 1사이클 고정 단계 Upsert: 같은 step_number 기록이 이미 있으면 덮어쓰고(무한 누적 방지), 없으면 새로 생성
        const existingStepLogs = await env.DB.prepare(
          `SELECT * FROM refinery_order_logs WHERE receipt_number = ? AND step_number = ? ORDER BY id DESC`
        )
          .bind(receiptNumber, stepNum)
          .all<Record<string, unknown>>();

        const prevStepLog = (existingStepLogs.results || [])[0];
        let prevMediaUrls: string[] = [];
        if (prevStepLog?.photo_url) {
          const rawUrl = String(prevStepLog.photo_url);
          if (rawUrl.startsWith("[")) {
            try {
              prevMediaUrls = JSON.parse(rawUrl);
            } catch {
              prevMediaUrls = [];
            }
          } else {
            prevMediaUrls = [rawUrl];
          }
        }

        let baseExistingUrls = prevMediaUrls;
        if (deleteMediaUrl) {
          baseExistingUrls = prevMediaUrls.filter((u) => u !== deleteMediaUrl);
          if (env.IMAGES_BUCKET && deleteMediaUrl.includes("/api/photos/")) {
            const r2KeyToDel = decodeURIComponent(
              deleteMediaUrl.split("/api/photos/")[1] || ""
            );
            if (r2KeyToDel) {
              try {
                await env.IMAGES_BUCKET.delete(r2KeyToDel);
              } catch {
                // ignore R2 delete error
              }
            }
          }
        } else if (retainedMediaUrls !== null) {
          const removedUrls = prevMediaUrls.filter(
            (u) => !retainedMediaUrls!.includes(u)
          );
          if (env.IMAGES_BUCKET) {
            for (const remUrl of removedUrls) {
              if (remUrl.includes("/api/photos/")) {
                const r2KeyToDel = decodeURIComponent(
                  remUrl.split("/api/photos/")[1] || ""
                );
                if (r2KeyToDel) {
                  try {
                    await env.IMAGES_BUCKET.delete(r2KeyToDel);
                  } catch {
                    // ignore
                  }
                }
              }
            }
          }
          baseExistingUrls = retainedMediaUrls;
        }

        const finalMediaUrls = deduplicateMediaUrls([
          ...baseExistingUrls,
          ...newMediaUrls,
        ]);
        const serializedMedia =
          finalMediaUrls.length > 0 ? JSON.stringify(finalMediaUrls) : null;

        const defaultTitles: Record<number, string> = {
          1: "작업비 입금 확인 및 입고 모재 정밀 실측 계량 완료",
          2: "단독 배치 선택적 용해 및 고순도 금 환원 침전 완료",
          3: "고온 용융 순금 비드(Gold Button) 성형 및 중량 검수 완료",
          4: "최종 정산 및 출고 완료 (정련 1사이클 마감)",
        };

        const finalTitle =
          logTitle ||
          (prevStepLog ? String(prevStepLog.log_title) : defaultTitles[stepNum]);
        const finalDetail =
          logDetail ||
          (prevStepLog
            ? String(prevStepLog.log_detail)
            : `${stageMap[stepNum]} 처리가 정상 완료되었습니다.`);
        const finalMeasured =
          measuredValue ||
          (prevStepLog && prevStepLog.measured_value
            ? String(prevStepLog.measured_value)
            : null);

        // 기존 해당 step_number의 중복/이전 로그 삭제 후 단일 공식 기록으로 저장
        await env.DB.prepare(
          `DELETE FROM refinery_order_logs WHERE receipt_number = ? AND step_number = ?`
        )
          .bind(receiptNumber, stepNum)
          .run();

        await env.DB.prepare(
          `INSERT INTO refinery_order_logs (
            receipt_number, step_number, stage_label, log_title, log_detail, operator_name, measured_value, photo_url, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            receiptNumber,
            stepNum,
            stageLabel || stageMap[stepNum] || `STEP 0${stepNum}`,
            finalTitle,
            finalDetail,
            "이온랩 정련팀 (원홍식 대표)",
            finalMeasured,
            serializedMedia,
            nowStr
          )
          .run();

        // (C) 주문 마스터 상태 업데이트 (현재 단계는 퇴행하지 않도록 유지하되, forceUnlock 시 지정 단계 반영, 4단계 완료 시 자동 잠금)
        const prevStep = Number(existingOrder.current_step || 0);
        const nextCurrentStep = forceUnlock
          ? stepNum
          : Math.max(prevStep, stepNum);
        const nextStatus =
          nextCurrentStep >= 4 ? "COMPLETED" : "PROCESSING";
        const nextLocked = nextCurrentStep >= 4 ? 1 : 0;
        const nextPaymentConfirmed =
          paymentConfirmed !== null
            ? paymentConfirmed
              ? 1
              : 0
            : stepNum >= 1
              ? 1
              : Number(existingOrder.payment_confirmed || 0);

        let nextWithholdingTax: number | null = null;
        let nextFinalPayout: number | null = null;
        if (
          actualGoldGrams !== null &&
          actualGoldGrams !== undefined &&
          Number(actualGoldGrams) > 0
        ) {
          const goldPriceNum = Number(existingOrder.gold_price || 171020);
          const buyPriceNum = Math.round(goldPriceNum * REFINERY_BUY_RATE);
          const cashGross = Math.round(Number(actualGoldGrams) * buyPriceNum);
          const taxOpt =
            (existingOrder.tax_option as TaxOptionType) ||
            "personal_withholding_33";
          const taxCalc = calculateTaxBreakdown(cashGross, taxOpt);
          nextWithholdingTax = taxCalc.withholdingTaxAmount;
          nextFinalPayout = taxCalc.finalCashPayout;
        }

        await env.DB.prepare(
          `UPDATE refinery_orders
           SET current_step = ?,
               status = ?,
               is_cycle_locked = ?,
               payment_confirmed = ?,
               actual_weight = COALESCE(?, actual_weight),
               actual_gold = COALESCE(?, actual_gold),
               withholding_tax_amount = COALESCE(?, withholding_tax_amount),
               final_cash_payout = COALESCE(?, final_cash_payout)
           WHERE receipt_number = ?`
        )
          .bind(
            nextCurrentStep,
            nextStatus,
            nextLocked,
            nextPaymentConfirmed,
            actualWeightKg,
            actualGoldGrams,
            nextWithholdingTax,
            nextFinalPayout,
            receiptNumber
          )
          .run();

        const updatedOrder = await env.DB.prepare(
          `SELECT * FROM refinery_orders WHERE receipt_number = ?`
        )
          .bind(receiptNumber)
          .first<Record<string, unknown>>();

        const updatedLogs = await env.DB.prepare(
          `SELECT * FROM refinery_order_logs WHERE receipt_number = ? ORDER BY step_number ASC`
        )
          .bind(receiptNumber)
          .all<Record<string, unknown>>();

        return new Response(
          JSON.stringify({
            ok: true,
            order: updatedOrder,
            logs: updatedLogs.results || [],
            uploadedMediaUrls: finalMediaUrls,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              ...cors,
            },
          }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : "UPDATE_ORDER_FAILED",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...cors },
          }
        );
      }
    }

    // ------------------------------------------------------------------------
    // 8. 정적 에셋 서빙 (Next.js App Build)
    // ------------------------------------------------------------------------
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("IONLAB Refinery Worker Active", { status: 200 });
  },
};
