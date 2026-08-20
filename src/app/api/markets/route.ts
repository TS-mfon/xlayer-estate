import { NextResponse } from "next/server";
import { readAllMarkets } from "@/lib/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await readAllMarkets();
    return NextResponse.json({ ...result, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("market registry API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketplace unavailable" }, { status: 502 });
  }
}
