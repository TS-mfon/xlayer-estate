"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, marketplaceAbi, rwaAbi } from "@/lib/abi";
import { explorerTx, PLATFORM_FEE_USDC, metadataGateway } from "@/lib/config";
import { useProtocolNetwork } from "@/lib/network-context";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { RouteHero, RouteMetric } from "@/components/RouteHero";
import { friendlyError } from "@/lib/errors";
import { assertSuccessfulReceipt, simulateContractWrite } from "@/lib/transactions";
import { listingLaunchState, MIN_SEED_USDC } from "@/lib/marketplace-state";
import { normalizeAssetInfo, type AssetInfo } from "@/lib/asset-info";
import { formatPercent, formatPrice } from "@/lib/format";
import { calculateMarketPricing } from "@/lib/market-data";
import type { AssetMetadata } from "@/lib/types";

type PoolRecord = readonly [bigint, bigint, bigint, bigint, boolean];
const EMPTY_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export default function MarketDetailPage({ params, searchParams }: { params: { tokenId: string }; searchParams?: { intent?: string } }) {
  const tokenId = BigInt(params.tokenId);
  const { address, isConnected } = useAccount();
  const { network } = useProtocolNetwork();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: network.id });
  const { writeContractAsync } = useWriteContract();
  const [buyAmount, setBuyAmount] = useState("10");
  const [sellAmount, setSellAmount] = useState("1");
  const [seedAmount, setSeedAmount] = useState("10");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastTxHash, setLastTxHash] = useState<`0x${string}`>();
  const [metadata, setMetadata] = useState<AssetMetadata | null>(null);
  const launchRef = useRef<HTMLDivElement>(null);
  const launchScrolledRef = useRef(false);

  const assetRead = useReadContract({ address: network.registry, abi: rwaAbi, functionName: "assetInfo", args: [tokenId], chainId: network.id });
  const poolRead = useReadContract({ address: network.marketplace, abi: marketplaceAbi, functionName: "pools", args: [tokenId], chainId: network.id });
  const usdcRead = useReadContract({ address: network.usdc, abi: erc20Abi, functionName: "balanceOf", args: [address ?? EMPTY_ADDRESS], chainId: network.id, query: { enabled: Boolean(address) } });
  const sharesRead = useReadContract({ address: network.registry, abi: rwaAbi, functionName: "balanceOf", args: [address ?? EMPTY_ADDRESS, tokenId], chainId: network.id, query: { enabled: Boolean(address) } });
  const allowanceRead = useReadContract({ address: network.usdc, abi: erc20Abi, functionName: "allowance", args: [address ?? EMPTY_ADDRESS, network.marketplace], chainId: network.id, query: { enabled: Boolean(address) } });
  const approvalRead = useReadContract({ address: network.registry, abi: rwaAbi, functionName: "isApprovedForAll", args: [address ?? EMPTY_ADDRESS, network.marketplace], chainId: network.id, query: { enabled: Boolean(address) } });
  const info = normalizeAssetInfo(assetRead.data);
  const pool = poolRead.data as PoolRecord | undefined;
  const active = Boolean(pool?.[4]);
  const launchIntent = searchParams?.intent === "list";
  const issuer = Boolean(address && info?.owner.toLowerCase() === address.toLowerCase());
  const wrongNetwork = chainId !== network.id;
  const walletReadsLoading = isConnected && (usdcRead.isLoading || sharesRead.isLoading || allowanceRead.isLoading || approvalRead.isLoading);
  const metadataUrl = info?.metadataURI ? metadataGateway(info.metadataURI) : "";

  useEffect(() => {
    if (!metadataUrl) return;
    let cancelled = false;
    fetch(metadataUrl)
      .then((response) => response.ok ? response.json() : null)
      .then((value: AssetMetadata | null) => { if (!cancelled) setMetadata(value); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [metadataUrl]);

  const buyRaw = useMemo(() => safeUnits(buyAmount, 6), [buyAmount]);
  const sellRaw = useMemo(() => { try { return BigInt(sellAmount || "0"); } catch { return 0n; } }, [sellAmount]);
  const seedRaw = useMemo(() => safeUnits(seedAmount, 6), [seedAmount]);
  const buyQuote = useReadContract({ address: network.marketplace, abi: marketplaceAbi, functionName: "quoteBuy", args: [tokenId, buyRaw], chainId: network.id, query: { enabled: active && buyRaw > PLATFORM_FEE_USDC } });
  const sellQuote = useReadContract({ address: network.marketplace, abi: marketplaceAbi, functionName: "quoteSell", args: [tokenId, sellRaw], chainId: network.id, query: { enabled: active && sellRaw > 0n } });
  const launchState = listingLaunchState({
    shareApproved: Boolean(approvalRead.data),
    allowance: allowanceRead.data ?? 0n,
    usdcBalance: usdcRead.data ?? 0n,
    shareBalance: sharesRead.data ?? 0n,
    seedUsdc: seedRaw,
    platformFeeUsdc: PLATFORM_FEE_USDC,
    launchValuationUsd: info?.launchValuationUsd ?? 0n,
    totalShares: info?.totalShares ?? 0n,
  });
  const seedApprovalRaw = launchState.requiredAllowance;
  const buyNeedsApproval = (allowanceRead.data ?? 0n) < buyRaw;
  const walletReadError = usdcRead.isError || sharesRead.isError || allowanceRead.isError || approvalRead.isError;
  const image = metadata?.image ? metadataGateway(metadata.image) : "";

  async function refreshReads() {
    await Promise.all([
      poolRead.refetch(),
      usdcRead.refetch(),
      sharesRead.refetch(),
      allowanceRead.refetch(),
      approvalRead.refetch(),
      assetRead.refetch(),
    ]);
  }

  async function transact(label: string, request: Parameters<typeof writeContractAsync>[0]) {
    setBusy(label);
    setError("");
    setNotice("");
    setLastTxHash(undefined);
    try {
      if (!client) throw new Error("X Layer RPC is not ready");
      if (!address) throw new Error("Connect the issuer wallet before signing");
      await simulateContractWrite(client, address, request as unknown as Record<string, unknown>);
      const hash = await writeContractAsync({ ...request, chainId: network.id });
      setLastTxHash(hash);
      assertSuccessfulReceipt(await client.waitForTransactionReceipt({ hash }));
      setNotice(`${label} confirmed on ${network.label}.`);
      await refreshReads();
      await fetch("/api/index/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash: hash, chainId: network.id }) }).catch(() => undefined);
    } catch (caught) {
      setError(friendlyError(caught, `${label} failed`));
    } finally {
      setBusy("");
    }
  }

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

  const launchTitle = launchIntent && !active ? <>Launch your<br/>asset market.</> : <>Fund the<br/>asset market.</>;
  return <div className="page-frame liquidity-desk">
    <RouteHero eyebrow={`${launchIntent && !active ? "Guided launch" : "Liquidity desk"} / asset #${params.tokenId}`} title={launchTitle} description={launchIntent && !active ? `Complete three clear wallet actions: approve shares, approve ${network.settlementLabel}, then create the pool. The interface advances after every confirmed transaction.` : `${network.settlementLabel} is the settlement asset; OKB is gas only. Every approval, fee, reserve change, and output quote remains visible before signing.`} aside={<><RouteMetric label="Market" value={active ? "Live" : "Unlisted"} tone={active ? "green" : "amber"}/><RouteMetric label="Your shares" value={sharesRead.isLoading ? "—" : Number(sharesRead.data ?? 0n).toLocaleString()}/><RouteMetric label={network.settlementLabel} value={usdcRead.isLoading ? "—" : Number(formatUnits(usdcRead.data ?? 0n,6)).toFixed(2)}/></>} />
    <div className="asset-command-bar"><span><i className={active ? "is-live" : ""}/>{active ? "Live market" : "Awaiting issuer liquidity"}</span><span>{network.shortLabel}</span><span>Protected execution</span></div>

    {notice && <Panel tone="success"><div className="launch-notice"><span>{notice}</span>{lastTxHash && <a href={explorerTx(network.id, lastTxHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}</div></Panel>}
    {error && <Panel tone="error"><div className="launch-notice"><span>{error}</span><button className="button button-ghost" onClick={() => setError("")}>Dismiss</button></div></Panel>}
    {assetRead.isLoading && <LaunchLoading />}
    {assetRead.isError && <Panel tone="error"><div className="launch-notice"><span>The asset registry read failed. The listing actions cannot start until the on-chain record loads.</span><button className="button button-ghost" onClick={() => assetRead.refetch()}>Retry asset read ↻</button></div></Panel>}
    {poolRead.isError && <Panel tone="error"><div className="launch-notice"><span>The marketplace pool state could not be read.</span><button className="button button-ghost" onClick={() => poolRead.refetch()}>Retry market read ↻</button></div></Panel>}
    {!assetRead.isLoading && !assetRead.isError && assetRead.data !== undefined && !info && <Panel tone="error"><div className="launch-notice"><span>The registry returned an unsupported asset record. Refresh after the frontend ABI is updated.</span><button className="button button-ghost" onClick={() => assetRead.refetch()}>Retry record ↻</button></div></Panel>}

    {info && launchIntent && !active && !poolRead.isError && <div className="launch-desk-grid">
      <AssetSummary tokenId={params.tokenId} info={info} metadata={metadata} image={image} shareBalance={sharesRead.data ?? 0n} />
      <aside className="transaction-console">
        {!isConnected && <Panel tone="warning">Connect the wallet that minted this asset using the navigation wallet button.</Panel>}
        {isConnected && wrongNetwork && <div className="glass-panel flex items-center justify-between gap-3 p-4 text-amber-100"><span>Switch to {network.label} to continue.</span><AddNetworkButton /></div>}
        {isConnected && !wrongNetwork && !issuer && <Panel tone="warning">This wallet is not the issuer. Connect {shortOwner(info.owner)} to approve shares and open the market.</Panel>}
        {isConnected && !wrongNetwork && issuer && walletReadsLoading && <LaunchLoading compact />}
        {isConnected && !wrongNetwork && issuer && !walletReadsLoading && walletReadError && <Panel tone="error"><div className="launch-notice"><span>Wallet balances or approvals could not be loaded.</span><button className="button button-ghost" onClick={refreshReads}>Retry wallet reads ↻</button></div></Panel>}
        {isConnected && !wrongNetwork && issuer && !walletReadsLoading && !walletReadError && <LaunchWizard settlementLabel={network.settlementLabel} launchRef={launchRef} launchState={launchState} seedAmount={seedAmount} setSeedAmount={setSeedAmount} shareBalance={sharesRead.data ?? 0n} usdcBalance={usdcRead.data ?? 0n} busy={busy} approved={Boolean(approvalRead.data)} allowance={allowanceRead.data ?? 0n} onApproveShares={() => transact("Share approval", { address: network.registry, abi: rwaAbi, functionName: "setApprovalForAll", args: [network.marketplace, true] })} onApproveUsdc={() => transact(`${network.settlementLabel} approval`, { address: network.usdc, abi: erc20Abi, functionName: "approve", args: [network.marketplace, seedApprovalRaw] })} onCreatePool={() => transact("Market creation", { address: network.marketplace, abi: marketplaceAbi, functionName: "createPool", args: [tokenId, seedRaw] })} />}
      </aside>
    </div>}

    {info && (!launchIntent || active) && <>
      {launchIntent && active && <Panel tone="success">Market launch complete. Asset #{params.tokenId} is live and ready to trade.</Panel>}
      <div className="market-detail-grid">
        <AssetSummary tokenId={params.tokenId} info={info} metadata={metadata} image={image} shareBalance={sharesRead.data ?? 0n} detailed pool={pool} />
        <aside className="transaction-console">
          {!isConnected && <Panel tone="warning">Connect a wallet to trade this asset.</Panel>}
          {isConnected && wrongNetwork && <div className="glass-panel flex items-center justify-between gap-3 p-4 text-amber-100"><span>Switch to {network.label} to continue.</span><AddNetworkButton /></div>}
          {active && <><MarketPricePanel info={info} pool={pool} /><TradeBox title="Acquire shares" amount={buyAmount} setAmount={setBuyAmount} quote={`${Number(buyQuote.data ?? 0n).toLocaleString()} shares`} hint="Your wallet signs the trade with the displayed minimum-output protection." action={buyNeedsApproval ? () => transact(`${network.settlementLabel} approval`, { address: network.usdc, abi: erc20Abi, functionName: "approve", args: [network.marketplace, buyRaw] }) : () => transact("Share purchase", { address: network.marketplace, abi: marketplaceAbi, functionName: "buy", args: [tokenId, buyRaw, (buyQuote.data ?? 0n) * 99n / 100n, BigInt(Math.floor(Date.now() / 1000) + 600)] })} label={buyNeedsApproval ? `Approve ${network.settlementLabel}` : "Buy shares"} disabled={!isConnected || Boolean(busy) || wrongNetwork || buyRaw <= PLATFORM_FEE_USDC} /><TradeBox title="Release shares" amount={sellAmount} setAmount={setSellAmount} quote={`${Number(formatUnits(sellQuote.data ?? 0n, 6)).toFixed(4)} ${network.settlementLabel} net`} hint="Your wallet signs the trade with the displayed minimum-output protection." action={!approvalRead.data ? () => transact("Share approval", { address: network.registry, abi: rwaAbi, functionName: "setApprovalForAll", args: [network.marketplace, true] }) : () => transact("Share sale", { address: network.marketplace, abi: marketplaceAbi, functionName: "sell", args: [tokenId, sellRaw, (sellQuote.data ?? 0n) * 99n / 100n, BigInt(Math.floor(Date.now() / 1000) + 600)] })} label={!approvalRead.data ? "Approve shares" : "Sell shares"} disabled={!isConnected || Boolean(busy) || wrongNetwork || sellRaw <= 0n} /></>}
          {!active && issuer && <a className="button button-primary" href={`/marketplace/${params.tokenId}?intent=list#launch`}>Start guided listing ↗</a>}
          {!active && !issuer && <Panel tone="warning">Only the original issuer can seed and open this market.</Panel>}
        </aside>
      </div>
    </>}
  </div>;
}

function LaunchWizard({ settlementLabel, launchRef, launchState, seedAmount, setSeedAmount, shareBalance, usdcBalance, busy, approved, allowance, onApproveShares, onApproveUsdc, onCreatePool }: { settlementLabel: string; launchRef: React.Ref<HTMLDivElement>; launchState: ReturnType<typeof listingLaunchState>; seedAmount: string; setSeedAmount: (value: string) => void; shareBalance: bigint; usdcBalance: bigint; busy: string; approved: boolean; allowance: bigint; onApproveShares: () => void; onApproveUsdc: () => void; onCreatePool: () => void }) {
  const seedRaw = safeUnits(seedAmount, 6);
  return <div id="launch" ref={launchRef} className="listing-wizard launch-wizard glass-panel">
    <div><p className="kicker">Step {launchState.step} of 3 / launch sequence</p><h2 data-launch-heading tabIndex={-1}>Open this asset market</h2><p>Each confirmed transaction unlocks the next action. Your seed establishes the initial reserve and the pool remains isolated to this asset.</p></div>
    <div className="wizard-steps">{["Approve shares", "Approve USDC", "Create pool"].map((label, index) => <span className={launchState.step > index + 1 ? "done" : launchState.step === index + 1 ? "active" : ""} key={label}>{index + 1}<small>{label}</small></span>)}</div>
    <div className="launch-balance-grid"><Stat label="Your shares" value={shareBalance.toLocaleString()} /><Stat label={settlementLabel} value={Number(formatUnits(usdcBalance, 6)).toFixed(2)} /><Stat label={`${settlementLabel} approved`} value={Number(formatUnits(allowance, 6)).toFixed(2)} /></div>
    <label className="field-label">Liquidity seed<input value={seedAmount} onChange={(event) => setSeedAmount(event.target.value)} inputMode="decimal" /><small>Wallet requirement: {Number(formatUnits(launchState.requiredAllowance, 6)).toFixed(2)} {settlementLabel}. The pool will receive {launchState.requiredShares.toLocaleString()} shares.</small></label>
    {!launchState.validSeed && <div className="twin-advisory is-warning">The launch seed must be at least {Number(formatUnits(MIN_SEED_USDC, 6)).toFixed(2)} {settlementLabel}.</div>}
    {!launchState.hasShares && launchState.validSeed && <div className="twin-advisory is-warning">This wallet needs {launchState.requiredShares.toLocaleString()} shares to create the pool but currently has {shareBalance.toLocaleString()}.</div>}
    {!launchState.hasFunds && <div className="faucet-recovery"><div><p>Balance shortfall: you have {Number(formatUnits(usdcBalance, 6)).toFixed(2)} of the required {Number(formatUnits(launchState.requiredAllowance, 6)).toFixed(2)} {settlementLabel}.</p><small>Fund this wallet with the configured settlement token before opening the pool.</small></div></div>}
    {!approved && <button className="button button-primary w-full" disabled={Boolean(busy)} onClick={onApproveShares}>{busy || "Step 1 · Approve asset shares"}</button>}
    {approved && allowance < launchState.requiredAllowance && <button className="button button-primary w-full" disabled={Boolean(busy) || !launchState.canApproveUsdc} onClick={onApproveUsdc}>{busy || `Step 2 · Approve ${Number(formatUnits(launchState.requiredAllowance, 6)).toFixed(2)} ${settlementLabel} allowance`}</button>}
    {approved && allowance >= launchState.requiredAllowance && <button className="button button-primary w-full" disabled={Boolean(busy) || !launchState.canCreatePool} onClick={onCreatePool}>{busy || "Step 3 · Open market ↗"}</button>}
  </div>;
}

function AssetSummary({ tokenId, info, metadata, image, shareBalance, detailed = false, pool }: { tokenId: string; info: AssetInfo; metadata: AssetMetadata | null; image: string; shareBalance: bigint; detailed?: boolean; pool?: PoolRecord }) {
  return <section className={`asset-gallery glass-panel ${detailed ? "" : "launch-asset-summary"}`}>
    <div className="asset-gallery-media">{image ? <Image src={image} alt={metadata?.name ?? `Asset ${tokenId}`} fill sizes="(max-width: 1024px) 100vw, 55vw" unoptimized/> : <div className="asset-gallery-placeholder"><span>✦</span><small>Loading asset twin</small></div>}<div className="gallery-scan"/><span className="gallery-index">PROPERTY / {tokenId.padStart(4,"0")}</span></div>
    <div className="asset-gallery-copy"><p className="kicker">On-chain property record</p><h2>{metadata?.name ?? `Asset #${tokenId}`}</h2><p>{metadata?.description ?? "AI-underwritten physical asset record secured on X Layer."}</p><div className="ledger-stats"><Stat label="AI valuation" value={`$${Number(info.valuationUsd).toLocaleString()}`} /><Stat label="Launch valuation" value={`$${Number(info.launchValuationUsd).toLocaleString()}`} /><Stat label="Risk" value={`${info.riskScore}/100`} /><Stat label="Your shares" value={Number(shareBalance).toLocaleString()} /></div>{detailed && pool?.[4] && <div className="live-pool"><p className="kicker">Live pool telemetry</p><div className="ledger-stats"><Stat label="Share reserve" value={Number(pool[0]).toLocaleString()} /><Stat label="USDC reserve" value={`${Number(formatUnits(pool[1], 6)).toFixed(2)} USDC`} /><Stat label="Spot price" value={`$${pool[0] ? (Number(pool[1]) / 1e6 / Number(pool[0])).toFixed(5) : "0"}`} /><Stat label="Locked LP" value={pool[3].toString()} /></div></div>}</div>
  </section>;
}

function MarketPricePanel({ info, pool }: { info: AssetInfo; pool?: PoolRecord }) {
  if (!pool?.[4]) return null;
  const pricing = calculateMarketPricing(info, pool);
  return <div className="market-price-panel glass-panel"><div><p className="kicker">Live AMM price</p><strong>{formatPrice(pricing.spotPricePerShare)}</strong><span>per share</span></div><div><p className="kicker">Implied market cap</p><strong>{formatPrice(pricing.impliedMarketCap)}</strong><span>{formatPercent(pricing.sinceLaunchChange)} since launch</span></div></div>;
}

function LaunchLoading({ compact = false }: { compact?: boolean }) { return <div className={`launch-loading glass-panel ${compact ? "is-compact" : ""}`}><span className="animate-pulse">✦</span><div><p className="kicker">Reading X Layer</p><h2>Preparing the launch sequence…</h2><p>Loading the issuer, balances, approvals, and pool state.</p></div></div>; }
function shortOwner(owner: string) { return `${owner.slice(0, 8)}…${owner.slice(-6)}`; }
function safeUnits(value: string, decimals: number) { try { return parseUnits(value || "0", decimals); } catch { return 0n; } }
function Stat({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function Panel({ children, tone }: { children: React.ReactNode; tone: "warning" | "success" | "error" }) { const color = tone === "success" ? "text-emerald-200" : tone === "error" ? "text-red-200" : "text-amber-100"; return <div className={`glass-panel mb-4 p-4 text-sm ${color}`}>{children}</div>; }
function TradeBox({ title, amount, setAmount, quote, hint, action, label, disabled }: { title: string; amount: string; setAmount: (value: string) => void; quote: string; hint: string; action: () => void; label: string; disabled: boolean }) { return <div className="trade-box glass-panel"><div className="trade-box-head"><p className="kicker">{title}</p><span>USDC / ERC-1155</span></div><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal"/><p>Estimated output: <strong>{quote}</strong> · 1% slippage protection</p><small>{hint}</small><button className="button button-primary w-full" onClick={action} disabled={disabled}>{label}</button></div>; }
