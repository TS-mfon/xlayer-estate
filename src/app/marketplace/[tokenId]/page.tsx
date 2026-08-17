"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, marketplaceAbi, rwaAbi } from "@/lib/abi";
import { FEE_COLLECTOR, MARKETPLACE_ADDRESS, PLATFORM_FEE_USDC, RWA_ADDRESS, USDC_ADDRESS, metadataGateway } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { FaucetButton } from "@/components/FaucetButton";
import { RouteHero, RouteMetric } from "@/components/RouteHero";
import { friendlyError } from "@/lib/errors";
import type { AssetMetadata } from "@/lib/types";

type AssetRecord = { owner?: string; valuationUsd?: bigint; launchValuationUsd?: bigint; riskScore?: number; metadataURI?: string };
type PoolRecord = readonly [bigint, bigint, bigint, bigint, boolean];

export default function MarketDetailPage({ params, searchParams }: { params: { tokenId: string }; searchParams?: { intent?: string } }) {
  const tokenId = BigInt(params.tokenId);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: xlayerTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const [buyAmount, setBuyAmount] = useState("10.20");
  const [sellAmount, setSellAmount] = useState("1");
  const [seedAmount, setSeedAmount] = useState("10");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState<AssetMetadata | null>(null);
  const launchRef = useRef<HTMLDivElement>(null);
  const launchScrolledRef = useRef(false);
  const [notice, setNotice] = useState("");
  const empty = "0x0000000000000000000000000000000000000000" as const;

  const { data: asset, refetch: refetchAsset } = useReadContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "assetInfo", args: [tokenId], chainId: xlayerTestnet.id });
  const { data: pool, refetch: refetchPool } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "pools", args: [tokenId], chainId: xlayerTestnet.id });
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address ?? empty], chainId: xlayerTestnet.id, query: { enabled: Boolean(address) } });
  const { data: shareBalance, refetch: refetchShares } = useReadContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "balanceOf", args: [address ?? empty, tokenId], chainId: xlayerTestnet.id, query: { enabled: Boolean(address) } });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "allowance", args: [address ?? empty, MARKETPLACE_ADDRESS], chainId: xlayerTestnet.id, query: { enabled: Boolean(address) } });
  const { data: approved, refetch: refetchApproval } = useReadContract({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "isApprovedForAll", args: [address ?? empty, MARKETPLACE_ADDRESS], chainId: xlayerTestnet.id, query: { enabled: Boolean(address) } });
  const poolTuple = pool as PoolRecord | undefined;
  const info = asset as AssetRecord | undefined;
  const active = Boolean(poolTuple?.[4]);
  const metadataUrl = info?.metadataURI ? metadataGateway(info.metadataURI) : "";

  useEffect(() => {
    if (!metadataUrl) return;
    let cancelled = false;
    fetch(metadataUrl).then((response) => response.ok ? response.json() : null).then((value: AssetMetadata | null) => { if (!cancelled) setMetadata(value); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [metadataUrl]);

  const buyRaw = useMemo(() => safeUnits(buyAmount, 6), [buyAmount]);
  const sellRaw = useMemo(() => { try { return BigInt(sellAmount || "0"); } catch { return 0n; } }, [sellAmount]);
  const seedRaw = useMemo(() => safeUnits(seedAmount, 6), [seedAmount]);
  const { data: buyQuote } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "quoteBuy", args: [tokenId, buyRaw], chainId: xlayerTestnet.id, query: { enabled: active && buyRaw > PLATFORM_FEE_USDC } });
  const { data: sellQuote } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "quoteSell", args: [tokenId, sellRaw], chainId: xlayerTestnet.id, query: { enabled: active && sellRaw > 0n } });

  async function transact(label: string, request: Parameters<typeof writeContractAsync>[0]) {
    setBusy(label); setError(""); setNotice("");
    try {
      const hash = await writeContractAsync({ ...request, chainId: xlayerTestnet.id });
      await client?.waitForTransactionReceipt({ hash });
      setNotice(`${label} confirmed on X Layer.`);
      await Promise.all([refetchPool(), refetchUsdc(), refetchShares(), refetchAllowance(), refetchApproval(), refetchAsset()]);
    } catch (caught) { setError(friendlyError(caught, `${label} failed`)); }
    finally { setBusy(""); }
  }

  const wrongNetwork = chainId !== xlayerTestnet.id;
  const issuer = Boolean(address && info?.owner?.toLowerCase() === address.toLowerCase());
  const seedApprovalRaw = seedRaw + PLATFORM_FEE_USDC;
  const buyNeedsApproval = (allowance ?? 0n) < buyRaw;
  const hasSeedFunds = (usdcBalance ?? 0n) >= seedApprovalRaw;
  const listingStep = !approved ? 1 : (allowance ?? 0n) < seedApprovalRaw ? 2 : 3;
  const image = metadata?.image ? metadataGateway(metadata.image) : "";
  const launchIntent = searchParams?.intent === "list";

  useEffect(() => {
    if (!launchIntent || active || !info || !issuer || launchScrolledRef.current) return;
    launchScrolledRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const launch = launchRef.current;
      if (!launch) {
        launchScrolledRef.current = false;
        return;
      }
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      launch.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      window.setTimeout(() => launch.querySelector<HTMLElement>("[data-launch-heading]")?.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active, info, issuer, launchIntent]);

  function jumpToLaunch() {
    launchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    launchRef.current?.querySelector<HTMLElement>("[data-launch-heading]")?.focus({ preventScroll: true });
  }

  return <div className="page-frame liquidity-desk">
    <RouteHero eyebrow={`Liquidity desk / asset #${params.tokenId}`} title={<>Fund the<br/>asset market.</>} description="USDC_TEST is the settlement asset; OKB is gas only. Every approval, fee, reserve change, and output quote remains visible before signing." aside={<><RouteMetric label="Market" value={active ? "Live" : "Unlisted"} tone={active ? "green" : "amber"}/><RouteMetric label="Your shares" value={Number(shareBalance ?? 0n).toLocaleString()}/><RouteMetric label="USDC" value={Number(formatUnits(usdcBalance ?? 0n,6)).toFixed(2)}/></>} />
    <div className="asset-command-bar"><span><i className={active ? "is-live" : ""}/>{active ? "Live market" : "Awaiting issuer liquidity"}</span><span>Fee collector {FEE_COLLECTOR.slice(0,8)}…{FEE_COLLECTOR.slice(-5)}</span><span>Fixed action fee $0.20</span></div>
    {!isConnected && <Panel tone="warning">Connect the wallet that owns or wants to trade this asset.</Panel>}
    {isConnected && wrongNetwork && <div className="glass-panel mb-4 flex items-center justify-between gap-3 p-4 text-amber-100"><span>Switch to X Layer Testnet to continue.</span><AddNetworkButton /></div>}
    {notice && <Panel tone="success">{notice}</Panel>}
    {launchIntent && !active && !isConnected && <Panel tone="warning">Connect the wallet that minted this asset to continue the three launch steps.</Panel>}
    {launchIntent && !active && isConnected && !info && <Panel tone="warning">Loading the issuer record and launch sequence…</Panel>}
    {launchIntent && !active && isConnected && info && !issuer && <Panel tone="warning">This wallet does not own the issuer position. Reconnect the wallet that minted this asset to open its market.</Panel>}
    {launchIntent && !active && issuer && <Panel tone="success"><div className="launch-notice"><span>Mint confirmed. Complete the three launch steps to open this market.</span><button className="button button-ghost" onClick={jumpToLaunch}>Go to launch steps ↓</button></div></Panel>}
    {error && <Panel tone="error">{error}</Panel>}
    {info && <div className="market-detail-grid">
      <section className="asset-gallery glass-panel">
        <div className="asset-gallery-media">{image ? <Image src={image} alt={metadata?.name ?? `Asset ${params.tokenId}`} fill sizes="(max-width: 1024px) 100vw, 55vw" unoptimized/> : <div className="asset-gallery-placeholder"><span>✦</span><small>Asset twin loading</small></div>}<div className="gallery-scan"/><span className="gallery-index">PROPERTY / {params.tokenId.padStart(4,"0")}</span></div>
        <div className="asset-gallery-copy"><p className="kicker">On-chain property record</p><h2>{metadata?.name ?? `Asset #${params.tokenId}`}</h2><p>{metadata?.description ?? "AI-underwritten physical asset record secured on X Layer."}</p><div className="ledger-stats"><Stat label="AI valuation" value={`$${Number(info.valuationUsd ?? 0n).toLocaleString()}`} /><Stat label="Launch valuation" value={`$${Number(info.launchValuationUsd ?? 0n).toLocaleString()}`} /><Stat label="Risk" value={`${Number(info.riskScore ?? 0)}/100`} /><Stat label="Your shares" value={Number(shareBalance ?? 0n).toLocaleString()} /></div>{active && poolTuple && <div className="live-pool"><p className="kicker">Live pool telemetry</p><div className="ledger-stats"><Stat label="Share reserve" value={Number(poolTuple[0]).toLocaleString()} /><Stat label="USDC reserve" value={`${Number(formatUnits(poolTuple[1], 6)).toFixed(2)} USDC`} /><Stat label="Spot price" value={`$${poolTuple[0] ? (Number(poolTuple[1]) / 1e6 / Number(poolTuple[0])).toFixed(5) : "0"}`} /><Stat label="Locked LP" value={poolTuple[3].toString()} /></div></div>}</div>
      </section>
      <aside className="transaction-console">
        {!active && issuer && <div id="launch" ref={launchRef} className="listing-wizard glass-panel"><div><p className="kicker">Launch sequence</p><h2 data-launch-heading tabIndex={-1}>List this digital property</h2><p>The $10+ seed stays in the pool. The separate $0.20 listing fee funds the protocol.</p></div><div className="wizard-steps">{["Approve shares", "Approve USDC", "Create pool"].map((label, index) => <span className={listingStep > index + 1 ? "done" : listingStep === index + 1 ? "active" : ""} key={label}>{index + 1}<small>{label}</small></span>)}</div>
          <label className="field-label">Liquidity seed<input value={seedAmount} onChange={(event) => setSeedAmount(event.target.value)} inputMode="decimal" /><small>Required from wallet: {Number(formatUnits(seedApprovalRaw, 6)).toFixed(2)} USDC_TEST including listing fee.</small></label>
          {!hasSeedFunds && <div className="faucet-recovery"><p>You need at least {Number(formatUnits(seedApprovalRaw, 6)).toFixed(2)} USDC_TEST.</p><FaucetButton onMinted={() => refetchUsdc()} /></div>}
          {!approved && <button className="button button-primary w-full" disabled={Boolean(busy) || wrongNetwork} onClick={() => transact("Share approval", { address: RWA_ADDRESS, abi: rwaAbi, functionName: "setApprovalForAll", args: [MARKETPLACE_ADDRESS, true] })}>{busy || "Step 1 · Approve asset shares"}</button>}
          {approved && (allowance ?? 0n) < seedApprovalRaw && <button className="button button-primary w-full" disabled={Boolean(busy) || wrongNetwork || !hasSeedFunds} onClick={() => transact("USDC approval", { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [MARKETPLACE_ADDRESS, seedApprovalRaw] })}>{busy || `Step 2 · Approve ${Number(formatUnits(seedApprovalRaw, 6)).toFixed(2)} USDC`}</button>}
          {approved && (allowance ?? 0n) >= seedApprovalRaw && <button className="button button-primary w-full" disabled={Boolean(busy) || wrongNetwork || !hasSeedFunds || seedRaw < 10_000_000n} onClick={() => transact("Market creation", { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "createPool", args: [tokenId, seedRaw] })}>{busy || "Step 3 · Open market ↗"}</button>}
        </div>}
        {active && <><TradeBox title="Acquire shares" amount={buyAmount} setAmount={setBuyAmount} quote={`${Number(buyQuote ?? 0n).toLocaleString()} shares`} hint="Amount includes the fixed $0.20 buy fee." action={buyNeedsApproval ? () => transact("USDC approval", { address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [MARKETPLACE_ADDRESS, buyRaw] }) : () => transact("Share purchase", { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "buy", args: [tokenId, buyRaw, (buyQuote ?? 0n) * 99n / 100n, BigInt(Math.floor(Date.now() / 1000) + 600)] })} label={buyNeedsApproval ? "Approve USDC" : "Buy shares"} disabled={Boolean(busy) || wrongNetwork || buyRaw <= PLATFORM_FEE_USDC} /><TradeBox title="Release shares" amount={sellAmount} setAmount={setSellAmount} quote={`${Number(formatUnits(sellQuote ?? 0n, 6)).toFixed(4)} USDC net`} hint="The fixed $0.20 sell fee is deducted from proceeds." action={!approved ? () => transact("Share approval", { address: RWA_ADDRESS, abi: rwaAbi, functionName: "setApprovalForAll", args: [MARKETPLACE_ADDRESS, true] }) : () => transact("Share sale", { address: MARKETPLACE_ADDRESS, abi: marketplaceAbi, functionName: "sell", args: [tokenId, sellRaw, (sellQuote ?? 0n) * 99n / 100n, BigInt(Math.floor(Date.now() / 1000) + 600)] })} label={!approved ? "Approve shares" : "Sell shares"} disabled={Boolean(busy) || wrongNetwork || sellRaw <= 0n} /></>}
        {!active && !issuer && <Panel tone="warning">Only the original issuer can seed and open this market.</Panel>}
      </aside>
    </div>}
  </div>;
}

function safeUnits(value: string, decimals: number) { try { return parseUnits(value || "0", decimals); } catch { return 0n; } }
function Stat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Panel({ children, tone }: { children: React.ReactNode; tone: "warning" | "success" | "error" }) { const color = tone === "success" ? "text-emerald-200" : tone === "error" ? "text-red-200" : "text-amber-100"; return <div className={`glass-panel mb-4 p-4 text-sm ${color}`}>{children}</div>; }
function TradeBox({ title, amount, setAmount, quote, hint, action, label, disabled }: { title: string; amount: string; setAmount: (value: string) => void; quote: string; hint: string; action: () => void; label: string; disabled: boolean }) { return <div className="trade-box glass-panel"><div className="trade-box-head"><p className="kicker">{title}</p><span>USDC / ERC-1155</span></div><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal"/><p>Estimated output: <strong>{quote}</strong> · 1% slippage protection</p><small>{hint}</small><button className="button button-primary w-full" onClick={action} disabled={disabled}>{label}</button></div>; }
