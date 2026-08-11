"use client";

import { useEffect, useState } from "react";
import { decodeEventLog } from "viem";
import { useAccount, useChainId, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnderwritingReport } from "@/components/UnderwritingReport";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS, TOTAL_SHARES, explorerToken, explorerTx } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import type { UnderwritingReport as Report } from "@/lib/types";

type Phase = "idle" | "underwriting" | "ready" | "minting" | "done" | "error";

export default function TokenizePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [tokenId, setTokenId] = useState("");
  const [metadataPinned, setMetadataPinned] = useState<boolean | null>(null);
  const { data: receipt, isLoading: txPending, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash, chainId: xlayerTestnet.id });

  const onFile = async (file: File) => {
    setPhase("underwriting"); setError(""); setReport(null); setTxHash(undefined); setTokenId("");
    try {
      const response = await fetch("/api/underwrite", { method: "POST", body: (() => { const form = new FormData(); form.append("file", file); return form; })() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Underwriting failed");
      setReport(data as Report); setPhase("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Underwriting failed"); setPhase("error");
    }
  };

  const onMint = async () => {
    if (!report || !address || chainId !== xlayerTestnet.id || contractMissing) return;
    setPhase("minting"); setError("");
    try {
      const response = await fetch("/api/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report }) });
      const metadata = await response.json() as { hash?: `0x${string}`; uri?: string; pinned?: boolean; error?: string };
      if (!response.ok || !metadata.hash || !metadata.uri) throw new Error(metadata.error ?? "Metadata preparation failed");
      setMetadataPinned(Boolean(metadata.pinned));
      const hash = await writeContractAsync({
        address: RWA_ADDRESS,
        abi: rwaAbi,
        functionName: "tokenizeProperty",
        chainId: xlayerTestnet.id,
        args: [address, BigInt(Math.round(report.valuationUsd)), Math.round(report.riskScore), metadata.hash, metadata.uri, TOTAL_SHARES],
      });
      setTxHash(hash);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mint failed"); setPhase("error");
    }
  };

  useEffect(() => {
    if (!txConfirmed) return;
    const event = receipt?.logs.find((log) => {
      try { return decodeEventLog({ abi: rwaAbi, data: log.data, topics: log.topics }).eventName === "AssetTokenized"; } catch { return false; }
    });
    if (event) {
      try {
        const decoded = decodeEventLog({ abi: rwaAbi, data: event.data, topics: event.topics });
        setTokenId(String((decoded.args as { tokenId: bigint }).tokenId));
      } catch { /* receipt is still valid even if an RPC omits the decoded event */ }
    }
    setPhase("done");
  }, [receipt, txConfirmed]);

  const contractMissing = RWA_ADDRESS === "0x0000000000000000000000000000000000000000";
  const wrongNetwork = chainId !== xlayerTestnet.id;
  const step = phase === "underwriting" ? 2 : phase === "ready" || phase === "minting" ? 3 : phase === "done" ? 4 : 1;

  return (
    <div className="page-frame">
      <div className="section-heading"><div><p className="kicker">Asset origination / 1952</p><h1 className="text-5xl font-semibold tracking-[-.06em] sm:text-7xl">Underwrite<br />an asset.</h1></div><p>Upload evidence. Let the agent read it. Mint the verified result.</p></div>
      <div className="mb-7 flex flex-wrap gap-2 text-xs text-white/45">{["Document", "AI report", "Tokenization", "Confirmed"].map((label, i) => <span key={label} className={`rounded-full border px-3 py-1.5 ${step > i ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10"}`}>{String(i + 1).padStart(2, "0")} / {label}</span>)}</div>
      {!isConnected && <div className="glass-panel mb-4 p-4 text-sm text-amber-200">Connect a wallet to mint. Underwriting preview works without a wallet.</div>}
      {isConnected && wrongNetwork && <div className="glass-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-amber-200"><span>Switch to X Layer Testnet before signing.</span><AddNetworkButton /></div>}
      {contractMissing && <div className="glass-panel mb-4 p-4 text-sm text-amber-200">No RWA contract address is configured.</div>}
      {(phase === "idle" || phase === "underwriting") && <UploadDropzone onFile={onFile} loading={phase === "underwriting"} />}
      {report && <div className="space-y-4"><UnderwritingReport report={report} /><div className="flex flex-wrap items-center gap-3"><button className="button button-primary" disabled={!isConnected || wrongNetwork || contractMissing || phase === "minting"} onClick={onMint}>{phase === "minting" || txPending ? "Writing to X Layer…" : "Mint verified asset ↗"}</button><button className="button button-ghost" onClick={() => { setReport(null); setPhase("idle"); }}>Start over</button>{txHash && <a className="text-sm text-cyan-200" href={explorerTx(xlayerTestnet.id, txHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}</div>{phase === "minting" && <div className="glass-panel p-4 text-sm text-cyan-100">Waiting for confirmation on X Layer…</div>}{phase === "done" && <div className="glass-panel p-5 text-sm text-emerald-200">Asset #{tokenId || "confirmed"} is live on X Layer. {metadataPinned ? "The report is pinned to IPFS." : "The report uses the local content-addressed fallback."} {tokenId && <a className="ml-2 underline" href={explorerToken(xlayerTestnet.id, RWA_ADDRESS, BigInt(tokenId))} target="_blank" rel="noreferrer">Open asset ↗</a>}</div>}{phase === "error" && <div className="glass-panel p-4 text-sm text-red-200">{error}</div>}</div>}
      {phase === "error" && !report && <div className="glass-panel mt-4 p-4 text-sm text-red-200">{error}</div>}
    </div>
  );
}
