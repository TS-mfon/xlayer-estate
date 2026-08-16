"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { marketplaceAbi, rwaAbi } from "@/lib/abi";
import { MARKETPLACE_ADDRESS, RWA_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { AssetCard, type AssetInfo } from "@/components/AssetCard";
import { discoverWalletTokenIds } from "@/lib/events";
import { FaucetButton } from "@/components/FaucetButton";
import { RouteHero, RouteMetric } from "@/components/RouteHero";

export default function DashboardPage() {
  const { address, isConnected } = useAccount(); const client = usePublicClient({ chainId: xlayerTestnet.id });
  const portfolio = useQuery({ queryKey: ["wallet-estate", address], enabled: Boolean(address && client), queryFn: async () => {
    if (!address || !client) return [];
    const ids = await discoverWalletTokenIds(client, address);
    if (!ids.length) return [];
    const [balances, details] = await Promise.all([
      client.readContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "balanceOfBatch", args: [ids.map(() => address), ids] }),
      client.multicall({ contracts: ids.flatMap((id) => [{ address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [id] } as const, { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [id] } as const]), allowFailure: true }),
    ]);
    return ids.map((id, index) => { const asset = details[index * 2]; const pool = details[index * 2 + 1]; if (asset.status !== "success") return null; const tuple = pool.status === "success" ? pool.result as readonly [bigint, bigint, bigint, bigint, boolean] : undefined; return { id, balance: balances[index], info: asset.result as unknown as AssetInfo, listed: Boolean(tuple?.[4]) }; }).filter(Boolean) as Array<{ id: bigint; balance: bigint; info: AssetInfo; listed: boolean }>;
  }, staleTime: 30_000 });
  const ready = portfolio.data?.filter((asset) => asset.info.owner.toLowerCase() === address?.toLowerCase() && !asset.listed) ?? [];
  const listed = portfolio.data?.filter((asset) => asset.listed) ?? [];
  const held = portfolio.data?.filter((asset) => asset.balance > 0n && asset.info.owner.toLowerCase() !== address?.toLowerCase()) ?? [];

  return <div className="page-frame estate-dashboard">
    <RouteHero eyebrow="Wallet estate / event indexed" title={<>Your digital<br/>property world.</>} description="Every XLayer Estate token originated by or transferred to this wallet, discovered from ERC-1155 events and verified against current balances." actions={<><button className="button button-ghost" onClick={() => portfolio.refetch()}>Refresh estate ↻</button><FaucetButton onMinted={() => portfolio.refetch()} /></>} aside={<><RouteMetric label="Ready" value={String(ready.length).padStart(2,"0")}/><RouteMetric label="Markets" value={String(listed.length).padStart(2,"0")} tone="green"/><RouteMetric label="Holdings" value={String(held.length).padStart(2,"0")} tone="amber"/></>} />
    {!isConnected && <div className="estate-empty glass-panel"><span>⌁</span><p className="kicker">Wallet not connected</p><h2>Connect to enter your estate.</h2><p>Your issued properties, active markets, and fractional holdings will assemble here.</p></div>}
    {portfolio.isLoading && <div className="estate-loading">{[1,2,3].map((item) => <div className="estate-card animate-pulse" key={item} />)}</div>}
    {portfolio.error && <div className="glass-panel p-5 text-red-200">The event index could not load. Check the RPC connection and retry.</div>}
    {isConnected && !portfolio.isLoading && portfolio.data?.length === 0 && <div className="estate-empty glass-panel"><span>✦</span><p className="kicker">No digital property yet</p><h2>Build the first asset in this wallet.</h2><p>A clear photo is enough to begin. Confidential ownership documents are not required.</p><a className="button button-primary mt-6" href="/tokenize">Tokenize an asset ↗</a></div>}
    <EstateSection title="Ready to list" subtitle="Issuer-owned assets that still need their first 10 USDC_TEST liquidity seed." assets={ready} address={address} />
    <EstateSection title="Live properties" subtitle="Assets with active USDC_TEST markets." assets={listed} address={address} />
    <EstateSection title="Fractional holdings" subtitle="Shares received or purchased from other issuers." assets={held} address={address} />
  </div>;
}
function EstateSection({ title, subtitle, assets, address }: { title: string; subtitle: string; assets: Array<{ id: bigint; balance: bigint; info: AssetInfo; listed: boolean }>; address?: string }) { if (!assets.length) return null; return <section className="estate-section"><div><p className="kicker">{String(assets.length).padStart(2, "0")} properties</p><h2>{title}</h2><p>{subtitle}</p></div><div className="estate-grid">{assets.map((asset) => <AssetCard key={asset.id.toString()} id={asset.id} info={asset.info} chainId={xlayerTestnet.id} balance={asset.balance} listed={asset.listed} wallet={address} />)}</div></section>; }
