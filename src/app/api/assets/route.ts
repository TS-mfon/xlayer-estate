import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { readWalletAssets } from "@/lib/indexer";
import { isSupportedChainId } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet") ?? "";
  const chainId = Number(request.nextUrl.searchParams.get("chainId") ?? "1952");
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
  if (!isSupportedChainId(chainId)) return NextResponse.json({ error: "Select X Layer testnet or mainnet" }, { status: 400 });
  try {
    const result = await readWalletAssets(chainId, wallet as Address);
    return NextResponse.json({ ...result, chainId, syncedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("asset registry API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Asset registry unavailable" }, { status: 502 });
  }
}
