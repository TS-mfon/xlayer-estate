"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { useProtocolNetwork } from "@/lib/network-context";

export function AddNetworkButton() {
  const chainId = useChainId();
  const { network } = useProtocolNetwork();
  const { switchChainAsync, isPending } = useSwitchChain();

  if (chainId === network.id) return <span className="network-status is-ready">{network.shortLabel}</span>;

  return <button className="button button-ghost !min-h-8 !py-1.5 !text-xs" disabled={isPending} onClick={() => switchChainAsync({ chainId: network.id })}>
    {isPending ? "Switching…" : `Switch to ${network.shortLabel}`}
  </button>;
}
