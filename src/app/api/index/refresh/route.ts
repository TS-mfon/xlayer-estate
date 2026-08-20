import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, type Hex } from "viem";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { syncIndex } from "@/lib/indexer";
import { serverPublicClient } from "@/lib/server-chain";
import { configuredNetwork, isSupportedChainId } from "@/lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { txHash?: string; chainId?: number };
    if (!body.txHash || !/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) return NextResponse.json({ error: "Valid transaction hash required" }, { status: 400 });
    const chainId = Number(body.chainId);
    if (!isSupportedChainId(chainId)) return NextResponse.json({ error: "Supported chainId required" }, { status: 400 });
    const network = configuredNetwork(chainId);
    const receipt = await serverPublicClient(chainId).getTransactionReceipt({ hash: body.txHash as Hex });
    if (receipt.status !== "success") return NextResponse.json({ error: "Transaction did not succeed" }, { status: 409 });
    const known = receipt.logs.some((log) => {
      if (![network.registry.toLowerCase(), network.marketplace.toLowerCase()].includes(log.address.toLowerCase())) return false;
      try { decodeEventLog({ abi: log.address.toLowerCase() === network.registry.toLowerCase() ? rwaAbi : marketplaceAbi, data: log.data, topics: log.topics }); return true; }
      catch { return false; }
    });
    if (!known) return NextResponse.json({ error: "Transaction does not contain a recognized protocol event" }, { status: 422 });
    return NextResponse.json({ ok: true, chainId, ...(await syncIndex(chainId)) });
  } catch (error) {
    console.error("transaction refresh failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Transaction refresh failed" }, { status: 502 });
  }
}
