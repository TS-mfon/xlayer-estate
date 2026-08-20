import { formatUnits } from "viem";
import type { AssetInfo } from "./asset-info";

export type PoolInfo = readonly [bigint, bigint, bigint, bigint, boolean];

export interface MarketPricing {
  spotPricePerShare: number;
  launchPricePerShare: number;
  impliedMarketCap: number;
  sinceLaunchChange: number | null;
  change24h: number | null;
}

export interface IndexedAsset {
  id: string;
  info: {
    owner: `0x${string}`;
    valuationUsd: string;
    launchValuationUsd: string;
    totalShares: string;
    riskScore: number;
    status: number;
    underwritingHash: `0x${string}`;
    metadataHash: `0x${string}`;
    metadataURI: string;
    timestamp: string;
  };
  balance?: string;
  listed: boolean;
  pool?: {
    shareReserve: string;
    usdcReserve: string;
    totalLiquidity: string;
    lockedLiquidity: string;
    active: boolean;
  };
  pricing?: MarketPricing;
}

export function calculateMarketPricing(info: AssetInfo, pool: PoolInfo, previousPrice?: number | null): MarketPricing {
  const shares = Number(pool[0]);
  const reserveUsdc = Number(formatUnits(pool[1], 6));
  const totalShares = Number(info.totalShares);
  const spotPricePerShare = shares > 0 ? reserveUsdc / shares : 0;
  const launchPricePerShare = totalShares > 0 ? Number(info.launchValuationUsd) / totalShares : 0;
  const impliedMarketCap = spotPricePerShare * totalShares;
  return {
    spotPricePerShare,
    launchPricePerShare,
    impliedMarketCap,
    sinceLaunchChange: launchPricePerShare > 0 ? (spotPricePerShare / launchPricePerShare - 1) * 100 : null,
    change24h: previousPrice && previousPrice > 0 ? (spotPricePerShare / previousPrice - 1) * 100 : null,
  };
}

export function serializeIndexedAsset(id: bigint, info: AssetInfo, pool?: PoolInfo, balance?: bigint, previousPrice?: number | null): IndexedAsset {
  return {
    id: id.toString(),
    info: {
      owner: info.owner,
      valuationUsd: info.valuationUsd.toString(),
      launchValuationUsd: info.launchValuationUsd.toString(),
      totalShares: info.totalShares.toString(),
      riskScore: info.riskScore,
      status: info.status,
      underwritingHash: info.underwritingHash,
      metadataHash: info.metadataHash,
      metadataURI: info.metadataURI,
      timestamp: info.timestamp.toString(),
    },
    balance: balance?.toString(),
    listed: Boolean(pool?.[4]),
    pool: pool ? {
      shareReserve: pool[0].toString(),
      usdcReserve: pool[1].toString(),
      totalLiquidity: pool[2].toString(),
      lockedLiquidity: pool[3].toString(),
      active: pool[4],
    } : undefined,
    pricing: pool?.[4] ? calculateMarketPricing(info, pool, previousPrice) : undefined,
  };
}

export function deserializeAssetInfo(asset: IndexedAsset): AssetInfo {
  return {
    owner: asset.info.owner,
    valuationUsd: BigInt(asset.info.valuationUsd),
    launchValuationUsd: BigInt(asset.info.launchValuationUsd),
    totalShares: BigInt(asset.info.totalShares),
    riskScore: asset.info.riskScore,
    status: asset.info.status,
    underwritingHash: asset.info.underwritingHash,
    metadataHash: asset.info.metadataHash,
    metadataURI: asset.info.metadataURI,
    timestamp: BigInt(asset.info.timestamp),
  };
}
