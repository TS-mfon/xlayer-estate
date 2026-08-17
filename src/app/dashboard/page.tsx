"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { AssetCard } from "@/components/AssetCard";
import { FaucetButton } from "@/components/FaucetButton";
import { RouteHero, RouteMetric } from "@/components/RouteHero";
import { chunkValues, normalizeAssetInfo, registryTokenIds, type AssetInfo } from "@/lib/asset-info";

type PortfolioAsset = { id: bigint; balance: bigint; info: AssetInfo; listed: boolean };

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: xlayerTestnet.id });
  const portfolio = useQuery({
    queryKey: ["wallet-estate", address, RWA_ADDRESS, MARKETPLACE_ADDRESS],
    enabled: Boolean(address && client),
    retry: 1,
    staleTime: 30_000,
    queryFn: async () => {
      if (!address || !client) return [];
      const totalAssets = await client.readContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "totalAssets" });
      const ids = registryTokenIds(totalAssets);
      const assets: PortfolioAsset[] = [];
      let decodedRecords = 0;

      for (const batch of chunkValues(ids, 40)) {
        const results = await client.multicall({
          contracts: batch.flatMap((id) => [
            { address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id] } as const,
            { address: RWA_ADDRESS, abi: rwaAbi, functionName: "balanceOf", args: [address, id] } as const,
            { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [id] } as const,
          ]),
          allowFailure: true,
        });

        batch.forEach((id, index) => {
          const assetRead = results[index * 3];
          const balanceRead = results[index * 3 + 1];
          const poolRead = results[index * 3 + 2];
          if (assetRead.status !== "success" || balanceRead.status !== "success") return;
          const info = normalizeAssetInfo(assetRead.result);
          if (!info) return;
          decodedRecords += 1;
          const balance = balanceRead.result as bigint;
          if (balance === 0n && info.owner.toLowerCase() !== address.toLowerCase()) return;
          const pool = poolRead.status === "success" ? poolRead.result as readonly [bigint, bigint, bigint, bigint, boolean] : undefined;
          assets.push({ id, balance, info, listed: Boolean(pool?.[4]) });
        });
      }

      if (ids.length && decodedRecords === 0) throw new Error("The registry returned records in an unsupported format");
      return assets.sort((left, right) => Number(right.id - left.id));
    },
  });
  const ready = portfolio.data?.filter((asset) => asset.info.owner.toLowerCase() === address?.toLowerCase() && !asset.listed) ?? [];
  const listed = portfolio.data?.filter((asset) => asset.listed) ?? [];
  const held = portfolio.data?.filter((asset) => asset.balance > 0n && asset.info.owner.toLowerCase() !== address?.toLowerCase()) ?? [];
  const metric = (count: number) => portfolio.isLoading ? "—" : String(count).padStart(2, "0");

  return <div className="page-frame estate-dashboard">
    <RouteHero eyebrow="Wallet estate / registry indexed" title={<>Your digital<br/>property world.</>} description="Every XLayer Estate token issued to or held by this wallet, read directly from the registry and verified against current balances." actions={<><button className="button button-ghost" disabled={portfolio.isFetching} onClick={() => portfolio.refetch()}>{portfolio.isFetching ? "Refreshing estate…" : "Refresh estate ↻"}</button><FaucetButton onMinted={() => portfolio.refetch()} /></>} aside={<><RouteMetric label="Ready" value={metric(ready.length)}/><RouteMetric label="Markets" value={metric(listed.length)} tone="green"/><RouteMetric label="Holdings" value={metric(held.length)} tone="amber"/></>} />
    {!isConnected && <div className="estate-empty glass-panel"><span>⌁</span><p className="kicker">Wallet not connected</p><h2>Connect to enter your estate.</h2><p>Your issued properties, active markets, and fractional holdings will assemble here.</p></div>}
    {portfolio.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {portfolio.error && <div className="glass-panel p-5 text-red-200"><p>The registry could not load this wallet&apos;s assets. Check the RPC connection and retry.</p><button className="button button-ghost mt-4" onClick={() => portfolio.refetch()}>Retry registry read ↻</button></div>}
    {isConnected && portfolio.isSuccess && portfolio.data.length === 0 && <div className="estate-empty glass-panel"><span>✦</span><p className="kicker">No digital property yet</p><h2>Build the first asset in this wallet.</h2><p>A clear photo is enough to begin. Confidential ownership documents are not required.</p><a className="button button-primary mt-6" href="/tokenize">Tokenize an asset ↗</a></div>}
    <EstateSection title="Ready to list" subtitle="Issuer-owned assets that still need their first 10 USDC_TEST liquidity seed." assets={ready} address={address} />
    <EstateSection title="Live properties" subtitle="Assets with active USDC_TEST markets." assets={listed} address={address} />
    <EstateSection title="Fractional holdings" subtitle="Shares received or purchased from other issuers." assets={held} address={address} />
  </div>;
}

function EstateSection({ title, subtitle, assets, address }: { title: string; subtitle: string; assets: PortfolioAsset[]; address?: string }) {
  if (!assets.length) return null;
  return <section className="estate-section"><div><p className="kicker">{String(assets.length).padStart(2, "0")} properties</p><h2>{title}</h2><p>{subtitle}</p></div><div className="estate-grid">{assets.map((asset) => <AssetCard key={asset.id.toString()} id={asset.id} info={asset.info} chainId={xlayerTestnet.id} balance={asset.balance} listed={asset.listed} wallet={address} />)}</div></section>;
}
