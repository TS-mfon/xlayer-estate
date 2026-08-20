"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { useProtocolNetwork } from "@/lib/network-context";
import { isNetworkConfigured, type SupportedChainId } from "@/lib/network";

export function NetworkSwitcher() {
  const walletChainId = useChainId();
  const { selectedChainId, selectNetwork } = useProtocolNetwork();
  const { switchChainAsync, isPending } = useSwitchChain();

  const choose = async (chainId: SupportedChainId) => {
    selectNetwork(chainId);
    if (walletChainId === chainId) return;
    try { await switchChainAsync({ chainId }); } catch { /* The action button will offer a retry. */ }
  };

  return <div className="network-switcher" aria-label="Select X Layer network">
    {([1952, 196] as const).map((chainId) => { const available = isNetworkConfigured(chainId); return <button key={chainId} type="button" className={selectedChainId === chainId ? "active" : ""} disabled={isPending || !available} onClick={() => choose(chainId)} title={available ? undefined : "Mainnet contracts are not configured yet"}>{chainId === 1952 ? "Testnet" : "Mainnet"}{!available ? " · soon" : ""}</button>; })}
  </div>;
}
