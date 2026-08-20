import { createPublicClient, http } from "viem";
import { xlayerTestnet } from "./chains";

export function serverPublicClient() {
  return createPublicClient({
    chain: xlayerTestnet,
    transport: http(xlayerTestnet.rpcUrls.default.http[0], { retryCount: 2, timeout: 15_000 }),
  });
}
