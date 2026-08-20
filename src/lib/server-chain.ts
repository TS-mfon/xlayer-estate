import { createPublicClient, http } from "viem";
import { getNetwork, type SupportedChainId } from "./network";

export function serverPublicClient(chainId: SupportedChainId = 1952) {
  const network = getNetwork(chainId);
  return createPublicClient({
    chain: network.chain,
    transport: http(network.chain.rpcUrls.default.http[0], { retryCount: 2, timeout: 15_000 }),
  });
}
