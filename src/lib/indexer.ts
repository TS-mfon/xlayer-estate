import type { Address } from "viem";
import { marketplaceAbi, rwaAbi } from "./abi";
import { cacheAsset, cachedMarkets, cachedWalletAssets, databaseEnabled } from "./database";
import { normalizeAssetInfo } from "./asset-info";
import { serializeIndexedAsset, type IndexedAsset, type PoolInfo } from "./market-data";
import { serverPublicClient } from "./server-chain";
import { configuredNetwork, type SupportedChainId } from "./network";

export async function readAllMarkets(chainId: SupportedChainId): Promise<{ assets: IndexedAsset[]; source: "chain" | "cache"; stale: boolean }> {
  const network = configuredNetwork(chainId);
  const client = serverPublicClient(chainId);
  try {
    const total = await client.readContract({ address: network.registry, abi: rwaAbi, functionName: "totalAssets" });
    const assets: IndexedAsset[] = [];
    for (let id = 1n; id <= total; id++) {
      const [rawInfo, pool] = await Promise.all([
        client.readContract({ address: network.registry, abi: rwaAbi, functionName: "assetInfo", args: [id] }),
        client.readContract({ address: network.marketplace, abi: marketplaceAbi, functionName: "pools", args: [id] }),
      ]);
      const info = normalizeAssetInfo(rawInfo);
      if (!info) continue;
      const typedPool = pool as PoolInfo;
      await cacheAsset(chainId, id, info, typedPool).catch((error) => console.warn("market cache write failed", error));
      if (typedPool[4]) assets.push(serializeIndexedAsset(id, info, typedPool));
    }
    return { assets: assets.reverse(), source: "chain", stale: false };
  } catch (error) {
    if (!databaseEnabled()) throw error;
    return { assets: await cachedMarkets(chainId), source: "cache", stale: true };
  }
}

export async function readWalletAssets(chainId: SupportedChainId, wallet: Address): Promise<{ assets: IndexedAsset[]; source: "chain" | "cache"; stale: boolean }> {
  const network = configuredNetwork(chainId);
  const client = serverPublicClient(chainId);
  try {
    const total = await client.readContract({ address: network.registry, abi: rwaAbi, functionName: "totalAssets" });
    const assets: IndexedAsset[] = [];
    for (let id = 1n; id <= total; id++) {
      const [rawInfo, balance, pool] = await Promise.all([
        client.readContract({ address: network.registry, abi: rwaAbi, functionName: "assetInfo", args: [id] }),
        client.readContract({ address: network.registry, abi: rwaAbi, functionName: "balanceOf", args: [wallet, id] }),
        client.readContract({ address: network.marketplace, abi: marketplaceAbi, functionName: "pools", args: [id] }),
      ]);
      const info = normalizeAssetInfo(rawInfo);
      if (!info) continue;
      const typedPool = pool as PoolInfo;
      await cacheAsset(chainId, id, info, typedPool, { wallet, value: balance }).catch((error) => console.warn("wallet cache write failed", error));
      if (balance > 0n || info.owner.toLowerCase() === wallet.toLowerCase()) assets.push(serializeIndexedAsset(id, info, typedPool, balance));
    }
    return { assets: assets.reverse(), source: "chain", stale: false };
  } catch (error) {
    if (!databaseEnabled()) throw error;
    return { assets: await cachedWalletAssets(chainId, wallet), source: "cache", stale: true };
  }
}

export async function syncIndex(chainId: SupportedChainId) {
  const markets = await readAllMarkets(chainId);
  return { assets: markets.assets.length, source: markets.source, stale: markets.stale, database: databaseEnabled() };
}
