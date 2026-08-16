"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { discoverMarketplaceTokenIds } from "@/lib/events";
import { AssetCard, type AssetInfo } from "@/components/AssetCard";

export default function MarketplacePage() {
  const client = usePublicClient({ chainId: xlayerTestnet.id });
  const markets = useQuery({ queryKey: ["marketplace-events"], enabled: Boolean(client), queryFn: async () => {
    if (!client) return [];
    const ids = await discoverMarketplaceTokenIds(client);
    const results = await client.multicall({ contracts: ids.flatMap((id) => [{ address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id] } as const, { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [id] } as const]), allowFailure: true });
    return ids.map((id, index) => { const asset = results[index * 2]; const pool = results[index * 2 + 1]; if (asset.status !== "success" || pool.status !== "success") return null; const tuple = pool.result as readonly [bigint, bigint, bigint, bigint, boolean]; return tuple[4] ? { id, info: asset.result as unknown as AssetInfo, pool: tuple } : null; }).filter(Boolean) as Array<{ id: bigint; info: AssetInfo; pool: readonly [bigint, bigint, bigint, bigint, boolean] }>;
  }, staleTime: 30_000 });
  return <div className="page-frame marketplace-world"><div className="section-heading"><div><p className="kicker">USDC_TEST / active property markets</p><h1 className="text-5xl font-semibold tracking-[-.06em] sm:text-7xl">The public<br />asset district.</h1></div><p>Browse only live liquidity pools. Every market starts with issuer capital, a conservative launch valuation, and transparent protocol fees.</p></div>
    <div className="market-stat-ribbon"><span><strong>{markets.data?.length ?? 0}</strong> live markets</span><span><strong>$10</strong> minimum seed</span><span><strong>$0.20</strong> fixed action fee</span><span><strong>0.30%</strong> AMM fee</span></div>
    {markets.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {markets.error && <div className="glass-panel p-5 text-red-200">Marketplace events could not be loaded. Retry after checking the X Layer RPC.</div>}
    {!markets.isLoading && markets.data?.length === 0 && <div className="estate-empty glass-panel"><span>◇</span><p className="kicker">District awaiting liquidity</p><h2>No issuer has opened a market yet.</h2><p>Mint an approved asset, then seed its first 10 USDC_TEST directly from the confirmation flow.</p><a className="button button-primary mt-6" href="/tokenize">Originate a property ↗</a></div>}
    <div className="estate-grid">{markets.data?.map((market) => <AssetCard key={market.id.toString()} id={market.id} info={market.info} chainId={xlayerTestnet.id} listed />)}</div>
  </div>;
}
