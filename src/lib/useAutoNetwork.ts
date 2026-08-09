"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { xlayerTestnet } from "./chains";

/**
 * Auto-switches the connected wallet to X Layer Testnet (chain 1952).
 *
 * Triggers when the user is connected but sitting on a different chain. If the
 * chain is not yet known to the wallet (MetaMask/OKX return error 4902), it
 * first calls `wallet_addEthereumChain` and then switches. A ref guard prevents
 * re-prompting on every render / re-trigger loop if the user rejects the switch.
 */
export function useAutoNetwork() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();
  const attempted = useRef(false);

  useEffect(() => {
    // Reset the guard whenever we (dis)connect or land on the right chain.
    if (!isConnected || chainId === xlayerTestnet.id) {
      attempted.current = false;
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    const hex = "0x" + xlayerTestnet.id.toString(16); // 0x7A0

    (async () => {
      try {
        await switchChainAsync({ chainId: xlayerTestnet.id });
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string; cause?: { code?: number } };
        const code = e?.code ?? e?.cause?.code;
        const msg = e?.message ?? "";
        const needsAdd = code === 4902 || /unrecognized chain|does not exist/i.test(msg);
        if (needsAdd) {
          try {
            const eth = (window as unknown as { ethereum?: any }).ethereum;
            if (eth?.request) {
              await eth.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: hex,
                    chainName: "X Layer Testnet",
                    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
                    rpcUrls: ["https://195.rpc.thirdweb.com", "https://xlayer-testnet.drpc.org"],
                    blockExplorerUrls: ["https://www.oklink.com/xlayer-test"],
                  },
                ],
              });
              await switchChainAsync({ chainId: xlayerTestnet.id });
            }
          } catch {
            // User rejected the add/switch — the manual "Switch to X Layer"
            // button remains available.
            attempted.current = false;
          }
        }
      }
    })();
  }, [isConnected, chainId, switchChainAsync]);

  return { isPending };
}
