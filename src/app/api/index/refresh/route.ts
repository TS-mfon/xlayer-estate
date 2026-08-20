import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, type Hex } from "viem";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { syncIndex } from "@/lib/indexer";
import { serverPublicClient } from "@/lib/server-chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { txHash?: string };
    if (!body.txHash || !/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) return NextResponse.json({ error: "Valid transaction hash required" }, { status: 400 });
    const receipt = await serverPublicClient().getTransactionReceipt({ hash: body.txHash as Hex });
    if (receipt.status !== "success") return NextResponse.json({ error: "Transaction did not succeed" }, { status: 409 });
    const known = receipt.logs.some((log) => {
      if (![RWA_ADDRESS.toLowerCase(), MARKETPLACE_ADDRESS.toLowerCase()].includes(log.address.toLowerCase())) return false;
      try { decodeEventLog({ abi: log.address.toLowerCase() === RWA_ADDRESS.toLowerCase() ? rwaAbi : marketplaceAbi, data: log.data, topics: log.topics }); return true; }
      catch { return false; }
    });
    if (!known) return NextResponse.json({ error: "Transaction does not contain a recognized protocol event" }, { status: 422 });
    return NextResponse.json({ ok: true, ...(await syncIndex()) });
  } catch (error) {
    console.error("transaction refresh failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transaction refresh failed" }, { status: 502 });
  }
}
