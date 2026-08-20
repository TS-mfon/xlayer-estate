import { DEFAULT_CHAIN_ID, getNetwork, type SupportedChainId } from "./network";

export const RWA_ADDRESS = getNetwork(DEFAULT_CHAIN_ID).registry;

/** Fractional ownership units minted per tokenized physical asset (ERC-1155 supply). */
export const TOTAL_SHARES = 1_000_000n;
export const MARKETPLACE_ADDRESS = getNetwork(DEFAULT_CHAIN_ID).marketplace;
export const USDC_ADDRESS = getNetwork(DEFAULT_CHAIN_ID).usdc;
export const USDC_DECIMALS = 6;
export const PLATFORM_FEE_USDC = 200_000n;
export const FEE_COLLECTOR = getNetwork(DEFAULT_CHAIN_ID).feeCollector;
export const RWA_DEPLOYMENT_BLOCK = getNetwork(DEFAULT_CHAIN_ID).registryDeploymentBlock;
export const MARKETPLACE_DEPLOYMENT_BLOCK = getNetwork(DEFAULT_CHAIN_ID).marketplaceDeploymentBlock;
export const LOG_CHUNK_SIZE = 9_000n;

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

export function networkConfig(chainId: SupportedChainId) {
  return getNetwork(chainId);
}
