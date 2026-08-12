"use client";

import { useEffect, useState } from "react";
import { decodeEventLog } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnderwritingReport } from "@/components/UnderwritingReport";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS, TOTAL_SHARES, explorerTx, MARKETPLACE_ADDRESS } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import type { UnderwritingReport as Report, UnderwritingResponse } from "@/lib/types";

type Phase = "idle" | "underwriting" | "ready" | "minting" | "done" | "error";

export default function TokenizePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [evaluationToken, setEvaluationToken] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [tokenId, setTokenId] = useState("");
  const [metadataPinned, setMetadataPinned] = useState<boolean | null>(null);
  const { data: receipt, isLoading: txPending, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash, chainId: xlayerTestnet.id });

  const onFile = async (file: File) => {
    setPhase("underwriting"); setError(""); setReport(null); setEvaluationToken(""); setTxHash(undefined); setTokenId("");
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/underwrite", { method: "POST", body: form });
      const data = await response.json() as UnderwritingResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message ?? "Underwriting failed");
      setReport(data.report); setEvaluationToken(data.evaluationToken ?? ""); setPhase("ready");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Underwriting failed"); setPhase("error"); }
  };

  const onMint = async () => {
    if (!report || !evaluationToken || !address || chainId !== xlayerTestnet.id || contractMissing) return;
    setPhase("minting"); setError("");
    try {
      const form = new FormData(); form.append("report", JSON.stringify(report)); form.append("evaluationToken", evaluationToken); form.append("recipient", address); if (image) form.append("image", image);
      const response = await fetch("/api/metadata", { method: "POST", body: form });
      const metadata = await response.json() as { hash?: `0x${string}`; metadataHash?: `0x${string}`; uri?: string; pinned?: boolean; nonce?: string; deadline?: string; signature?: `0x${string}`; error?: { message?: string } };
      if (!response.ok || !metadata.hash || !metadata.metadataHash || !metadata.uri || !metadata.nonce || !metadata.deadline || !metadata.signature) throw new Error(metadata.error?.message ?? "Metadata preparation failed");
      setMetadataPinned(Boolean(metadata.pinned));
      const hash = await writeContractAsync({ address: RWA_ADDRESS, abi: rwaAbi, functionName: "tokenizeProperty", chainId: xlayerTestnet.id, args: [address, BigInt(Math.round(report.valuationUsd)), BigInt(Math.round(report.launchValuationUsd)), Math.round(report.riskScore), metadata.hash, metadata.metadataHash, metadata.uri, TOTAL_SHARES, BigInt(metadata.nonce), BigInt(metadata.deadline), metadata.signature] });
      setTxHash(hash);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Mint failed"); setPhase("error"); }
  };

  useEffect(() => {
    if (!txConfirmed) return;
    const event = receipt?.logs.find((log) => { try { return decodeEventLog({ abi: rwaAbi, data: log.data, topics: log.topics }).eventName === "AssetTokenized"; } catch { return false; } });
    if (event) { try { const decoded = decodeEventLog({ abi: rwaAbi, data: event.data, topics: event.topics }); setTokenId(String((decoded.args as { tokenId: bigint }).tokenId)); } catch { /* receipt remains usable */ } }
    setPhase("done");
  }, [receipt, txConfirmed]);

  const contractMissing = RWA_ADDRESS === "0x0000000000000000000000000000000000000000";
  const wrongNetwork = chainId !== xlayerTestnet.id;
  const canMint = Boolean(report?.mintEligible && evaluationToken && isConnected && !wrongNetwork && !contractMissing);
  const step = phase === "underwriting" ? 2 : phase === "ready" || phase === "minting" ? 3 : phase === "done" ? 4 : 1;

  return <div className="page-frame">
    <div className="section-heading"><div><p className="kicker">Asset origination / 1952</p><h1 className="text-5xl font-semibold tracking-[-.06em] sm:text-7xl">Underwrite<br />an asset.</h1></div><p>Only evidence-backed property reports can become tradable RWA shares.</p></div>
    <div className="mb-7 flex flex-wrap gap-2 text-xs text-white/45">{["Document", "AI gate", "Mint", "Listed"].map((label, i) => <span key={label} className={`rounded-full border px-3 py-1.5 ${step > i ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10"}`}>{String(i + 1).padStart(2, "0")} / {label}</span>)}</div>
    {!isConnected && <div className="glass-panel mb-4 p-4 text-sm text-amber-200">Connect a wallet to mint. Underwriting preview works without a wallet.</div>}
    {isConnected && wrongNetwork && <div className="glass-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-amber-200"><span>Switch to X Layer Testnet before signing.</span><AddNetworkButton /></div>}
    {contractMissing && <div className="glass-panel mb-4 p-4 text-sm text-amber-200">The registry contract address is not configured.</div>}
    {(phase === "idle" || phase === "underwriting") && <UploadDropzone onFile={onFile} onImage={setImage} loading={phase === "underwriting"} />}
    {report && <div className="space-y-4"><UnderwritingReport report={report} />{report.decision === "approved" && <div className="glass-panel flex flex-wrap items-center gap-3 p-4 text-sm"><label className="flex cursor-pointer items-center gap-2 text-white/70"><input type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /><span className="button button-ghost">{image ? `Photo: ${image.name}` : "Attach property photo (optional)"}</span></label><span className="text-white/40">A branded image card is generated if omitted.</span></div>}<div className="flex flex-wrap items-center gap-3"><button className="button button-primary" disabled={!canMint || phase === "minting"} onClick={onMint}>{phase === "minting" || txPending ? "Writing verified asset…" : report.decision === "approved" ? "Mint tradable asset ↗" : "Mint unavailable"}</button><button className="button button-ghost" onClick={() => { setReport(null); setPhase("idle"); }}>Start over</button>{txHash && <a className="text-sm text-cyan-200" href={explorerTx(xlayerTestnet.id, txHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}</div>{phase === "done" && <div className="glass-panel p-5 text-sm text-emerald-200">Asset #{tokenId || "confirmed"} is minted. {metadataPinned ? "Metadata and image are pinned to IPFS." : "Demo metadata uses a content-addressed fallback."} {tokenId && <a className="ml-2 underline" href={`/marketplace/${tokenId}`}>Open marketplace ↗</a>}</div>}{phase === "error" && <div className="glass-panel p-4 text-sm text-red-200">{error}</div>}{report.decision !== "approved" && <div className="glass-panel p-4 text-sm text-amber-100">This report cannot be minted until the document passes the authenticity and evidence thresholds.</div>}</div>}
    {phase === "error" && !report && <div className="glass-panel mt-4 p-4 text-sm text-red-200">{error}</div>}
    {MARKETPLACE_ADDRESS === "0x0000000000000000000000000000000000000000" && phase === "done" && <p className="mt-4 text-xs text-amber-200/70">Marketplace contract is not configured yet; listing will become available after deployment.</p>}
  </div>;
}
