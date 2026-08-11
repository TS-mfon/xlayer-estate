"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
// Bypass `wagmi/connectors` barrel (pulls @coinbase/cdp-sdk -> @x402/*).
import { injected } from "@wagmi/core";
import { shortAddress } from "@/lib/format";
import { AddNetworkButton } from "./AddNetworkButton";
import { useAutoNetwork } from "@/lib/useAutoNetwork";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  // Auto-switch the wallet to X Layer Testnet (chain 1952) once connected.
  const { isPending: isSwitching } = useAutoNetwork();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-cyan-200/10 bg-white/[.04] px-3 py-2 font-mono text-xs text-white/80">
          {shortAddress(address)}
        </span>
        <AddNetworkButton />
        <button className="button button-ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="button button-primary"
      disabled={isConnecting || isSwitching}
      onClick={() => connect({ connector: injected() })}
    >
      {isConnecting ? "Connecting…" : isSwitching ? "Switching network…" : "Connect Wallet"}
    </button>
  );
}
