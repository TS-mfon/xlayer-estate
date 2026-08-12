export const RWA_ADDRESS = (process.env.NEXT_PUBLIC_RWA_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

/** Fractional ownership units minted per tokenized property (ERC-1155 supply). */
export const TOTAL_SHARES = 1_000_000n;
export const MARKETPLACE_ADDRESS = (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d") as `0x${string}`;
export const USDC_DECIMALS = 6;

export const EXPLORERS: Record<number, string> = {
  1952: "https://www.oklink.com/xlayer-test",
  196: "https://www.oklink.com/xlayer",
};

export function explorerTx(chainId: number, hash: string) {
  const base = EXPLORERS[chainId] ?? EXPLORERS[1952];
  return `${base}/tx/${hash}`;
}

export function explorerToken(chainId: number, address: string, tokenId: bigint) {
  const base = EXPLORERS[chainId] ?? EXPLORERS[1952];
  return `${base}/token/${address}?a=${tokenId.toString()}`;
}

export function metadataGateway(uri: string) {
  return uri.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
}
