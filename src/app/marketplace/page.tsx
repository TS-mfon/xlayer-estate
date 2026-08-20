"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AssetCard } from "@/components/AssetCard";
import { deserializeAssetInfo, type IndexedAsset } from "@/lib/market-data";
import { xlayerTestnet } from "@/lib/chains";

async function loadMarkets() {
  const response = await fetch("/api/markets", { cache: "no-store" });
  const body = await response.json() as { assets?: IndexedAsset[]; source?: string; stale?: boolean; error?: string };
  if (!response.ok) throw new Error(body.error ?? "The marketplace is temporarily unavailable.");
  return body;
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "price" | "liquidity">("newest");
  const markets = useQuery({ queryKey: ["marketplace"], queryFn: loadMarkets, staleTime: 15_000, refetchInterval: 15_000 });
  const visibleMarkets = useMemo(() => [...(markets.data?.assets ?? [])].filter((market) => !search || market.id.includes(search) || market.info.owner.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "price" ? (b.pricing?.spotPricePerShare ?? 0) - (a.pricing?.spotPricePerShare ?? 0) : sort === "liquidity" ? Number(b.pool?.usdcReserve ?? 0) - Number(a.pool?.usdcReserve ?? 0) : Number(BigInt(b.id) - BigInt(a.id))), [markets.data, search, sort]);
  return <div className="page-frame marketplace-world marketplace-simple">
    <div className="marketplace-simple-heading"><div><p className="kicker">Listed assets / USDC_TEST</p><h1>Trade live<br/>asset shares.</h1></div><p>Only assets with an active liquidity pool appear here. Prices are read from current X Layer reserves.</p></div>
    <div className="market-controls glass-panel"><label><span>Search assets</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Token ID or issuer address" /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}><option value="newest">Newest listed</option><option value="price">Highest price</option><option value="liquidity">Most liquidity</option></select></label><button className="button button-ghost" onClick={() => markets.refetch()} disabled={markets.isFetching}>{markets.isFetching ? "Refreshing…" : "Refresh"}</button></div>
    {markets.data?.stale && <div className="glass-panel p-4 text-amber-100">Showing the latest indexed markets while the chain RPC recovers.</div>}
    {markets.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {markets.error && <div className="estate-empty glass-panel"><span>◇</span><p className="kicker">Marketplace unavailable</p><h2>{markets.error instanceof Error ? markets.error.message : "Could not load listed assets."}</h2><button className="button button-ghost mt-5" onClick={() => markets.refetch()}>Retry marketplace ↻</button></div>}
    {!markets.isLoading && !markets.error && visibleMarkets.length === 0 && <div className="estate-empty glass-panel"><span>◇</span><p className="kicker">No listed assets</p><h2>Markets appear after an issuer seeds liquidity.</h2><p>This view intentionally excludes unlisted assets.</p></div>}
    <div className="estate-grid">{visibleMarkets.map((market) => <AssetCard key={market.id} id={BigInt(market.id)} info={deserializeAssetInfo(market)} chainId={xlayerTestnet.id} listed pricing={market.pricing ?? undefined} />)}</div>
  </div>;
}
