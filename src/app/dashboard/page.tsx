"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { AssetCard, type AssetInfo } from "@/components/AssetCard";

export default function DashboardPage() {
  const contractMissing = RWA_ADDRESS === "0x0000000000000000000000000000000000000000";
  const { data: total, isLoading: totalLoading, refetch } = useReadContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "totalAssets", chainId: xlayerTestnet.id, query: { enabled: !contractMissing } });
  const ids = total ? Array.from({ length: Math.min(Number(total), 100) }, (_, index) => BigInt(index + 1)) : [];
  const { data: infos, isLoading } = useReadContracts({ contracts: ids.map((id) => ({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id], chainId: xlayerTestnet.id })), query: { enabled: !contractMissing && ids.length > 0 } });
  const assets = (infos ?? []).map((result, index) => result.status === "success" ? { id: ids[index], info: result.result as unknown as AssetInfo } : null).filter(Boolean) as { id: bigint; info: AssetInfo }[];

  return (
    <div className="page-frame">
      <div className="section-heading"><div><p className="kicker">On-chain registry / X Layer 1952</p><h1 className="text-5xl font-semibold tracking-[-.06em] sm:text-7xl">Asset<br />registry.</h1></div><div><p>{Number(total ?? 0)} verified asset{Number(total ?? 0) === 1 ? "" : "s"} indexed.</p><button className="button button-ghost mt-4" onClick={() => refetch()}>Refresh registry ↻</button></div></div>
      {contractMissing && <div className="glass-panel p-6 text-sm text-amber-200">The registry contract address is not configured.</div>}
      {!contractMissing && (totalLoading || isLoading) && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="glass-panel h-52 animate-pulse bg-white/[.03]" />)}</div>}
      {!contractMissing && !totalLoading && !isLoading && assets.length === 0 && <div className="glass-panel p-8"><p className="kicker">No assets yet</p><h2 className="mt-3 text-2xl font-semibold">The registry is waiting for its first signal.</h2><a className="button button-primary mt-6" href="/tokenize">Originate an asset ↗</a></div>}
      <div className="dashboard-grid">{assets.map((asset) => <AssetCard key={asset.id.toString()} id={asset.id} info={asset.info} chainId={xlayerTestnet.id} />)}</div>
    </div>
  );
}
