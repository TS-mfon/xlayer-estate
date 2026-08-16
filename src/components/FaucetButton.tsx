"use client";

import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi } from "@/lib/abi";
import { USDC_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";

export function FaucetButton({ onMinted }: { onMinted?: () => void }) {
  const { address } = useAccount(); const chainId = useChainId(); const client = usePublicClient({ chainId: xlayerTestnet.id }); const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle"); const [error, setError] = useState("");
  async function mint() {
    if (!address || chainId !== xlayerTestnet.id) return;
    setState("busy"); setError("");
    try { const hash = await writeContractAsync({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "mint", args: [address, parseUnits("25", 6)], chainId: xlayerTestnet.id }); await client?.waitForTransactionReceipt({ hash }); setState("done"); onMinted?.(); }
    catch (caught) { setError(friendlyError(caught, "Test USDC mint failed")); setState("idle"); }
  }
  return <div><button className="button button-ghost" disabled={!address || chainId !== xlayerTestnet.id || state === "busy"} onClick={mint}>{state === "busy" ? "Minting test USDC…" : state === "done" ? "25 USDC_TEST received ✓" : "Get 25 test USDC"}</button>{error && <p className="mt-2 text-xs text-red-200">{error}</p>}</div>;
}
