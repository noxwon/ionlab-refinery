import { NextResponse } from "next/server";
import { fetchKrxGoldPrice } from "@/lib/backend-core";

export async function GET() {
  const result = await fetchKrxGoldPrice(process.env.KRX_API_KEY);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
