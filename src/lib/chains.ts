import { defineChain } from "viem";

/**
 * X Layer Testnet — true EVM chain ID is 1952.
 * NOTE: the thirdweb proxy `https://195.rpc.thirdweb.com` misreports eth_chainId
 * as 195, so we use dRPC (correctly reports 1952) as the primary read endpoint and
 * keep thirdweb as a fallback (it accepts txs signed for chainId 1952).
 */
export const xlayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://xlayer-testnet.drpc.org",
        "https://195.rpc.thirdweb.com",
      ],
    },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
  },
  testnet: true,
});

/** X Layer Mainnet — chain ID 196 (post-hackathon launch). */
export const xlayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.xlayer.tech"] },
  },
  blockExplorers: {
    default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
  },
});
