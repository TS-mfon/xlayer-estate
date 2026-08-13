"use client";

import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { formatUsd } from "@/lib/format";

export default function MarketplacePage() {
  const configured = MARKETPLACE_ADDRESS !== "0x0000000000000000000000000000000000000000";
  const { data: total, isLoading: totalLoading } = useReadContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "totalAssets", chainId: xlayerTestnet.id });
  const ids = total ? Array.from({ length: Math.min(Number(total), 100) }, (_, index) => BigInt(index + 1)) : [];
  const { data, isLoading } = useReadContracts({ contracts: ids.flatMap((id) => [
    { address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id], chainId: xlayerTestnet.id },
    { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [id], chainId: xlayerTestnet.id },
  ]), query: { enabled: configured && ids.length > 0 } });

  const markets = ids.map((id, index) => {
    const assetResult = data?.[index * 2]; const poolResult = data?.[index * 2 + 1];
    if (assetResult?.status !== "success") return null;
    const info = assetResult.result as any;
    const pool = poolResult?.status === "success" ? poolResult.result as unknown as readonly [bigint, bigint, bigint, bigint, boolean] : undefined;
    return { id, info, pool };
  }).filter(Boolean) as { id: bigint; info: any; pool?: readonly [bigint, bigint, bigint, bigint, boolean] }[];

  return <div className="page-frame">
    <div className="section-heading"><div><p className="kicker">USDC_TEST / fractional RWA</p><h1 className="text-5xl font-semibold tracking-[-.06em] sm:text-7xl">Physical asset<br />markets.</h1></div><p>Trade fractional ERC-1155 shares of community-listed physical assets through valuation-anchored USDC liquidity pools.</p></div>
    {!configured && <div className="glass-panel p-6 text-amber-200">Marketplace deployment is not configured.</div>}
    {(totalLoading || isLoading) && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((item) => <div className="glass-panel h-56 animate-pulse" key={item} />)}</div>}
    {!totalLoading && markets.length === 0 && <div className="glass-panel p-8"><p className="kicker">No markets yet</p><h2 className="mt-3 text-2xl font-semibold">Mint an approved asset and seed its first 10 USDC of liquidity.</h2><Link href="/tokenize" className="button button-primary mt-6">Create the first market ↗</Link></div>}
    <div className="dashboard-grid">{markets.map(({ id, info, pool }) => {
      const active = Boolean(pool?.[4]); const spot = active && pool![0] > 0n ? Number(pool![1]) / 1e6 / Number(pool![0]) : Number(info.launchValuationUsd) / Number(info.totalShares);
      return <Link href={`/marketplace/${id}`} key={id.toString()} className="glass-panel group p-5 transition hover:-translate-y-1 hover:border-cyan-200/30"><div className="flex justify-between"><span className="kicker">Asset #{id.toString()}</span><span className={`rounded-full px-2 py-1 text-xs ${active ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200"}`}>{active ? "Trading" : "Needs liquidity"}</span></div><h2 className="mt-8 text-xl font-semibold">{info.owner ? `Tokenized physical asset #${id}` : "Physical asset"}</h2><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div><p className="text-white/40">Launch value</p><p>{formatUsd(info.launchValuationUsd)}</p></div><div><p className="text-white/40">Spot / share</p><p>${spot.toFixed(4)}</p></div><div><p className="text-white/40">USDC reserve</p><p>{active ? `${(Number(pool![1]) / 1e6).toFixed(2)} USDC` : "0"}</p></div><div><p className="text-white/40">Risk</p><p>{Number(info.riskScore)}/100</p></div></div></Link>;
    })}</div>
  </div>;
}
