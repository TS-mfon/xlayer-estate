"use client";

import { parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { erc20Abi } from "@/lib/abi";
import { useProtocolNetwork } from "@/lib/network-context";
import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { assertSuccessfulReceipt, simulateContractWrite } from "@/lib/transactions";

export function FaucetButton({ onMinted }: { onMinted?: () => void }) {
  const { network } = useProtocolNetwork();
  const { address } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: network.id });
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  if (!network.isTestnet) return null;
  async function mint() {
    if (!address || chainId !== network.id) return;
    setState("busy"); setError("");
    try {
      if (!client) throw new Error("X Layer RPC is not ready");
      const request = { address: network.usdc, abi: erc20Abi, functionName: "mint", args: [address, parseUnits("25", 6)] } as const;
      await simulateContractWrite(client, address, request as unknown as Record<string, unknown>);
      const hash = await writeContractAsync({ ...request, chainId: network.id });
      assertSuccessfulReceipt(await client.waitForTransactionReceipt({ hash }));
      setState("done"); onMinted?.();
    } catch (caught) { setError(friendlyError(caught, "Test USDC mint failed")); setState("idle"); }
  }
  return <div><button className="button button-ghost" disabled={!address || chainId !== network.id || state === "busy"} onClick={mint}>{state === "busy" ? "Minting protocol test USDC…" : state === "done" ? "25 USDC_TEST received ✓" : "Get 25 protocol test USDC"}</button><p className="mt-2 max-w-xs text-xs text-white/45">USDC_TEST is XLayer Estate’s project MockUSDC for testnet demos. It is not official Circle USDC and has no real-world value.</p>{error && <p className="mt-2 text-xs text-red-200">{error}</p>}</div>;
}
