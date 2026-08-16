"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { discoverMarketplaceTokenIds } from "@/lib/events";
import { AssetCard, type AssetInfo } from "@/components/AssetCard";
import { RouteHero, RouteMetric } from "@/components/RouteHero";

export default function MarketplacePage() {
  const client = usePublicClient({ chainId: xlayerTestnet.id });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "valuation" | "liquidity">("newest");
  const markets = useQuery({ queryKey: ["marketplace-events"], enabled: Boolean(client), queryFn: async () => {
    if (!client) return [];
    const ids = await discoverMarketplaceTokenIds(client);
    const results = await client.multicall({ contracts: ids.flatMap((id) => [{ address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id] } as const, { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [id] } as const]), allowFailure: true });
    return ids.map((id, index) => { const asset = results[index * 2]; const pool = results[index * 2 + 1]; if (asset.status !== "success" || pool.status !== "success") return null; const tuple = pool.result as readonly [bigint, bigint, bigint, bigint, boolean]; return tuple[4] ? { id, info: asset.result as unknown as AssetInfo, pool: tuple } : null; }).filter(Boolean) as Array<{ id: bigint; info: AssetInfo; pool: readonly [bigint, bigint, bigint, bigint, boolean] }>;
  }, staleTime: 30_000 });
  const visibleMarkets = useMemo(() => [...(markets.data ?? [])].filter((market) => !search || market.id.toString().includes(search) || market.info.owner.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "valuation" ? Number(b.info.valuationUsd - a.info.valuationUsd) : sort === "liquidity" ? Number(b.pool[1] - a.pool[1]) : Number(b.id - a.id)), [markets.data, search, sort]);
  const totalLiquidity = markets.data?.reduce((sum, market) => sum + Number(market.pool[1]) / 1e6, 0) ?? 0;
  return <div className="page-frame marketplace-world"><RouteHero eyebrow="USDC_TEST / active asset markets" title={<>The public<br/>asset district.</>} description="Browse live liquidity pools where issuer capital, conservative launch valuations, and transparent protocol fees meet on-chain settlement." actions={<a className="button button-primary" href="/tokenize">Originate an asset ↗</a>} aside={<><RouteMetric label="Live markets" value={String(markets.data?.length ?? 0).padStart(2,"0")}/><RouteMetric label="Liquidity" value={`$${totalLiquidity.toFixed(2)}`} tone="green"/><RouteMetric label="Action fee" value="$0.20" tone="amber"/></>} />
    <div className="market-controls glass-panel"><label><span>Search estate</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Token ID or issuer address" /></label><label><span>Sort district</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest markets</option><option value="valuation">Highest valuation</option><option value="liquidity">Deepest liquidity</option></select></label><div className="market-control-status"><span className="live-pulse"/>Chain indexed live</div></div>
    <div className="market-stat-ribbon"><span><strong>{markets.data?.length ?? 0}</strong> live markets</span><span><strong>$10</strong> minimum seed</span><span><strong>$0.20</strong> fixed action fee</span><span><strong>0.30%</strong> AMM fee</span></div>
    {markets.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {markets.error && <div className="glass-panel p-5 text-red-200">Marketplace events could not be loaded. Retry after checking the X Layer RPC.</div>}
    {!markets.isLoading && markets.data?.length === 0 && <div className="estate-empty glass-panel"><span>◇</span><p className="kicker">District awaiting liquidity</p><h2>No issuer has opened a market yet.</h2><p>Mint an approved asset, then seed its first 10 USDC_TEST directly from the confirmation flow.</p><a className="button button-primary mt-6" href="/tokenize">Originate a property ↗</a></div>}
    <div className="estate-grid">{visibleMarkets.map((market) => <AssetCard key={market.id.toString()} id={market.id} info={market.info} chainId={xlayerTestnet.id} listed />)}</div>
  </div>;
}
