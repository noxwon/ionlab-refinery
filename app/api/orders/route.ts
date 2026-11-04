import { NextRequest, NextResponse } from "next/server";

const CF_WORKER_ORIGIN = "https://ionlab-refinery.wonhongsik.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${CF_WORKER_ORIGIN}/api/orders`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "ORDER_PROXY_FAILED",
      },
      { status: 500 }
    );
  }
}
