import { NextRequest, NextResponse } from "next/server";
import { syncIndex } from "@/lib/indexer";
import { isSupportedChainId } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.INDEXER_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.INDEXER_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requested = request.nextUrl.searchParams.get("chainId");
  const chainIds = requested ? [Number(requested)] : [1952, 196];
  if (chainIds.some((chainId) => !isSupportedChainId(chainId))) return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
  try {
    const results = await Promise.allSettled(chainIds.map(async (chainId) => ({ chainId, ...(await syncIndex(chainId as 1952 | 196)) })));
    const networks = results.map((result, index) => result.status === "fulfilled" ? result.value : { chainId: chainIds[index], error: result.reason instanceof Error ? result.reason.message : "Index sync failed" });
    return NextResponse.json({ ok: results.some((result) => result.status === "fulfilled"), networks, syncedAt: new Date().toISOString() }, { status: results.every((result) => result.status === "rejected") ? 502 : 200 });
  }
  catch (error) { console.error("index sync failed", error); return NextResponse.json({ error: error instanceof Error ? error.message : "Index sync failed" }, { status: 502 }); }
}
