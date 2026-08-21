import { createPublicClient, fallback, http } from "viem";
import { getNetwork, type SupportedChainId } from "./network";

export function serverPublicClient(chainId: SupportedChainId = 1952) {
  const network = getNetwork(chainId);
  const transports = network.chain.rpcUrls.default.http.map((url) =>
    http(url, {
      batch: false,
      retryCount: 2,
      timeout: 15_000,
    }),
  );
  return createPublicClient({
    chain: network.chain,
    transport: fallback(transports, { rank: false }),
  });
}
