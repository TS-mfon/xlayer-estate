import type { Address, Hex } from "viem";

export type AssetInfoResult = readonly [
  Address,
  bigint,
  bigint,
  bigint,
  number,
  number,
  Hex,
  Hex,
  string,
  bigint,
];

export interface AssetInfo {
  owner: Address;
  valuationUsd: bigint;
  launchValuationUsd: bigint;
  totalShares: bigint;
  riskScore: number;
  status: number;
  underwritingHash: Hex;
  metadataHash: Hex;
  metadataURI: string;
  timestamp: bigint;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function normalizeAssetInfo(value: unknown): AssetInfo | null {
  if (!Array.isArray(value) || value.length !== 10) return null;
  const [owner, valuationUsd, launchValuationUsd, totalShares, riskScore, status, underwritingHash, metadataHash, metadataURI, timestamp] = value as unknown as AssetInfoResult;
  if (typeof owner !== "string" || owner.toLowerCase() === ZERO_ADDRESS || typeof metadataURI !== "string") return null;
  return {
    owner,
    valuationUsd: BigInt(valuationUsd),
    launchValuationUsd: BigInt(launchValuationUsd),
    totalShares: BigInt(totalShares),
    riskScore: Number(riskScore),
    status: Number(status),
    underwritingHash,
    metadataHash,
    metadataURI,
    timestamp: BigInt(timestamp),
  };
}

export function registryTokenIds(totalAssets: bigint) {
  if (totalAssets <= 0n) return [];
  if (totalAssets > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Registry asset count exceeds browser indexing limits");
  return Array.from({ length: Number(totalAssets) }, (_, index) => BigInt(index + 1));
}

export function chunkValues<T>(values: T[], size = 50) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}
