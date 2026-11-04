import { NextRequest, NextResponse } from "next/server";

const CF_WORKER_ORIGIN = "https://ionlab-refinery.wonhongsik.workers.dev";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const res = await fetch(`${CF_WORKER_ORIGIN}/api/admin/update-order`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      const body = await req.json();
      const res = await fetch(`${CF_WORKER_ORIGIN}/api/admin/update-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "ADMIN_UPDATE_PROXY_FAILED",
      },
      { status: 500 }
    );
  }
}
