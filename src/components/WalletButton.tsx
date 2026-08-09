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
        <span className="rounded-md bg-white/5 px-3 py-1.5 font-mono text-sm text-white/80">
          {shortAddress(address)}
        </span>
        <AddNetworkButton />
        <button className="btn btn-ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      className="btn btn-primary"
      disabled={isConnecting || isSwitching}
      onClick={() => connect({ connector: injected() })}
    >
      {isConnecting ? "Connecting…" : isSwitching ? "Switching network…" : "Connect Wallet"}
    </button>
  );
}
