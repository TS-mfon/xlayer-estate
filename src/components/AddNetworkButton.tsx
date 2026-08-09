"use client";

import { useChainId } from "wagmi";
import { xlayerTestnet } from "@/lib/chains";

/** Adds/switches the wallet to X Layer Testnet (chain 1952) on demand. */
export function AddNetworkButton() {
  const chainId = useChainId();

  if (chainId === xlayerTestnet.id) {
    return (
      <span className="rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-300">
        X Layer Testnet
      </span>
    );
  }

  const addNetwork = async () => {
    const eth = (window as unknown as { ethereum?: any }).ethereum;
    if (!eth?.request) return;
    const hexChain = "0x7A0"; // 1952
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChain }],
      });
    } catch (err: any) {
      if (err?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: hexChain,
              chainName: "X Layer Testnet",
              nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
              rpcUrls: [
                "https://195.rpc.thirdweb.com",
                "https://xlayer-testnet.drpc.org",
              ],
              blockExplorerUrls: ["https://www.oklink.com/xlayer-test"],
            },
          ],
        });
      }
    }
  };

  return (
    <button className="btn btn-ghost !py-1.5 !text-xs" onClick={addNetwork}>
      Switch to X Layer
    </button>
  );
}
