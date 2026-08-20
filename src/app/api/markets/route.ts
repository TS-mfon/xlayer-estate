import { NextRequest, NextResponse } from "next/server";
import { readAllMarkets } from "@/lib/indexer";
import { isSupportedChainId } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chainId = Number(request.nextUrl.searchParams.get("chainId") ?? "1952");
  if (!isSupportedChainId(chainId)) return NextResponse.json({ error: "Select X Layer testnet or mainnet" }, { status: 400 });
  try {
    const result = await readAllMarkets(chainId);
    return NextResponse.json({ ...result, chainId, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("market registry API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketplace unavailable" }, { status: 502 });
  }
}
