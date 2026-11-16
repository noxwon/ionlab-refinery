import { NextRequest, NextResponse } from "next/server";
import { fetchAligoTemplatesAndQuota } from "@/lib/backend-core";

const CF_WORKER_ORIGIN = "https://ionlab-refinery.wonhongsik.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 로컬 환경에서도 직접 알리고 상태 확인 가능하도록 우선 호출 후 필요 시 워커 프록시
    const localStatus = await fetchAligoTemplatesAndQuota();
    if (localStatus.ok) {
      return NextResponse.json(localStatus, { status: 200 });
    }
    const res = await fetch(`${CF_WORKER_ORIGIN}/api/admin/alimtalk/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "ALIMTALK_STATUS_PROXY_FAILED",
      },
      { status: 500 }
    );
  }
}
