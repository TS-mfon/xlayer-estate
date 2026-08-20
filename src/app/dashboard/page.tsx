"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { AssetCard } from "@/components/AssetCard";
import { FaucetButton } from "@/components/FaucetButton";
import { RouteHero, RouteMetric } from "@/components/RouteHero";
import { xlayerTestnet } from "@/lib/chains";
import { deserializeAssetInfo, type IndexedAsset } from "@/lib/market-data";

type PortfolioAsset = { id: bigint; balance: bigint; info: ReturnType<typeof deserializeAssetInfo>; listed: boolean; pricing?: IndexedAsset["pricing"] };

async function loadWalletAssets(wallet: string) {
  const response = await fetch(`/api/assets?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" });
  const body = await response.json() as { assets?: IndexedAsset[]; source?: string; stale?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error ?? "The asset registry is temporarily unavailable.");
  return { ...body, assets: (body.assets ?? []).map((asset) => ({ id: BigInt(asset.id), balance: BigInt(asset.balance ?? "0"), info: deserializeAssetInfo(asset), listed: asset.listed, pricing: asset.pricing })) };
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const portfolio = useQuery({ queryKey: ["wallet-estate", address], enabled: Boolean(address), retry: 1, staleTime: 15_000, queryFn: () => loadWalletAssets(address!) });
  const assets = portfolio.data?.assets ?? [];
  const ready = assets.filter((asset) => asset.info.owner.toLowerCase() === address?.toLowerCase() && !asset.listed);
  const listed = assets.filter((asset) => asset.listed);
  const held = assets.filter((asset) => asset.balance > 0n && asset.info.owner.toLowerCase() !== address?.toLowerCase());
  const metric = (count: number) => portfolio.isLoading ? "—" : String(count).padStart(2, "0");

  return <div className="page-frame estate-dashboard">
    <RouteHero eyebrow="Wallet estate / durable registry" title={<>Your digital<br/>property world.</>} description="Your assets and holdings are read from X Layer and cached in the protocol index so they remain visible across sessions and RPC interruptions." actions={<><button className="button button-ghost" disabled={portfolio.isFetching} onClick={() => portfolio.refetch()}>{portfolio.isFetching ? "Refreshing estate…" : "Refresh estate ↻"}</button><FaucetButton onMinted={() => portfolio.refetch()} /></>} aside={<><RouteMetric label="Ready" value={metric(ready.length)}/><RouteMetric label="Markets" value={metric(listed.length)} tone="green"/><RouteMetric label="Holdings" value={metric(held.length)} tone="amber"/></>} />
    {portfolio.data?.stale && <div className="glass-panel p-4 text-amber-100">Showing the latest indexed snapshot while the chain RPC recovers. Refresh to reconcile live balances.</div>}
    {!isConnected && <div className="estate-empty glass-panel"><span>⌁</span><p className="kicker">Wallet not connected</p><h2>Connect to enter your estate.</h2><p>Your issued assets, active markets, and fractional holdings will assemble here.</p></div>}
    {portfolio.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {portfolio.error && <div className="glass-panel p-5 text-red-200"><p>{portfolio.error instanceof Error ? portfolio.error.message : "The asset registry could not be loaded."}</p><button className="button button-ghost mt-4" onClick={() => portfolio.refetch()}>Retry registry read ↻</button></div>}
    {isConnected && portfolio.isSuccess && assets.length === 0 && <div className="estate-empty glass-panel"><span>✦</span><p className="kicker">No digital property yet</p><h2>Build the first asset in this wallet.</h2><p>A clear photo is enough to begin. Confidential ownership documents are not required.</p><a className="button button-primary mt-6" href="/tokenize">Tokenize an asset ↗</a></div>}
    <EstateSection title="Ready to list" subtitle="Issuer-owned assets that still need their first liquidity seed." assets={ready} address={address} />
    <EstateSection title="Live properties" subtitle="Assets with active USDC_TEST markets and live share prices." assets={listed} address={address} />
    <EstateSection title="Fractional holdings" subtitle="Shares received or purchased from other issuers." assets={held} address={address} />
  </div>;
}

function EstateSection({ title, subtitle, assets, address }: { title: string; subtitle: string; assets: PortfolioAsset[]; address?: string }) {
  if (!assets.length) return null;
  return <section className="estate-section"><div><p className="kicker">{String(assets.length).padStart(2, "0")} properties</p><h2>{title}</h2><p>{subtitle}</p></div><div className="estate-grid">{assets.map((asset) => <AssetCard key={asset.id.toString()} id={asset.id} info={asset.info} chainId={xlayerTestnet.id} balance={asset.balance} listed={asset.listed} wallet={address} pricing={asset.pricing ?? undefined} />)}</div></section>;
}
