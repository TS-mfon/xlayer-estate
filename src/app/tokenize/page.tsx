"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog } from "viem";
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnderwritingReport } from "@/components/UnderwritingReport";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS, TOTAL_SHARES, explorerTx } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import { friendlyError, responseError } from "@/lib/errors";
import type { GeneratedAssetImage, UnderwritingReport as Report, UnderwritingResponse } from "@/lib/types";
import { RouteHero, RouteMetric } from "@/components/RouteHero";
import { simulateContractWrite } from "@/lib/transactions";

type Phase = "idle" | "underwriting" | "image" | "review" | "minting" | "confirmed" | "error";

export default function TokenizePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: xlayerTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [evaluationToken, setEvaluationToken] = useState("");
  const [generatedImage, setGeneratedImage] = useState<GeneratedAssetImage | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imageToken, setImageToken] = useState("");
  const [imageAttempt, setImageAttempt] = useState(1);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState<`0x${string}`>();
  const [tokenId, setTokenId] = useState("");
  const { data: receipt, isLoading: txPending, isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash, chainId: xlayerTestnet.id });

  async function generateTwin(nextReport: Report, token: string, attempt: number, fallbackFile = sourceFile) {
    setPhase("image"); setError("");
    try {
      const form = new FormData();
      form.append("report", JSON.stringify(nextReport)); form.append("evaluationToken", token); form.append("attempt", String(attempt));
      if (address) form.append("wallet", address);
      if (fallbackFile?.type.startsWith("image/")) form.append("sourceFile", fallbackFile);
      const response = await fetch("/api/generate-image", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseError(response, "Asset twin generation failed"));
      const data = await response.json() as { image?: GeneratedAssetImage; imageToken?: string };
      if (!data.image || !data.imageToken) throw new Error("The image generator returned no approved asset twin");
      setGeneratedImage(data.image); setImageToken(data.imageToken); setImageAttempt(attempt); setPhase("review");
    } catch (caught) { setError(friendlyError(caught, "Asset twin generation failed")); setPhase("error"); }
  }

  async function onFile(file: File) {
    setPhase("underwriting"); setError(""); setReport(null); setEvaluationToken(""); setGeneratedImage(null); setImageToken(""); setSourceFile(file); setTxHash(undefined); setTokenId(""); setImageAttempt(1);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/underwrite", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseError(response, "Underwriting failed"));
      const data = await response.json() as UnderwritingResponse;
      setReport(data.report); setEvaluationToken(data.evaluationToken ?? "");
      if (data.report.mintEligible && data.evaluationToken) await generateTwin(data.report, data.evaluationToken, 1, file);
      else setPhase("review");
    } catch (caught) { setError(friendlyError(caught, "Underwriting failed")); setPhase("error"); }
  }

  async function onMint() {
    if (!report || !evaluationToken || !generatedImage || !imageToken || !address || chainId !== xlayerTestnet.id || contractMissing) return;
    setPhase("minting"); setError("");
    try {
      const form = new FormData();
      form.append("report", JSON.stringify(report)); form.append("evaluationToken", evaluationToken); form.append("recipient", address); form.append("image", JSON.stringify(generatedImage)); form.append("imageToken", imageToken);
      const response = await fetch("/api/metadata", { method: "POST", body: form });
      if (!response.ok) throw new Error(await responseError(response, "Metadata preparation failed"));
      const metadata = await response.json() as { hash?: `0x${string}`; metadataHash?: `0x${string}`; uri?: string; nonce?: string; deadline?: string; signature?: `0x${string}` };
      if (!metadata.hash || !metadata.metadataHash || !metadata.uri || !metadata.nonce || !metadata.deadline || !metadata.signature) throw new Error("Mint authorization is incomplete");
      if (!client) throw new Error("X Layer RPC is not ready");
      const request = { address: RWA_ADDRESS, abi: rwaAbi, functionName: "tokenizeProperty", args: [address, BigInt(Math.round(report.valuationUsd)), BigInt(Math.round(report.launchValuationUsd)), Math.round(report.riskScore), metadata.hash, metadata.metadataHash, metadata.uri, TOTAL_SHARES, BigInt(metadata.nonce), BigInt(metadata.deadline), metadata.signature] } as const;
      await simulateContractWrite(client, address, request as unknown as Record<string, unknown>);
      const hash = await writeContractAsync({ ...request, chainId: xlayerTestnet.id });
      setTxHash(hash);
    } catch (caught) { setError(friendlyError(caught, "Mint failed")); setPhase("error"); }
  }

  useEffect(() => {
    if (!txConfirmed || !receipt) return;
    if (receipt.status !== "success") {
      setError("Mint transaction reverted on X Layer.");
      setPhase("error");
      return;
    }
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: rwaAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "AssetTokenized") { setTokenId(String(decoded.args.tokenId)); break; }
      } catch { /* unrelated receipt log */ }
    }
    setPhase("confirmed");
  }, [receipt, txConfirmed]);

  useEffect(() => {
    if (phase !== "confirmed" || !tokenId) return;
    const timer = window.setTimeout(() => router.push(`/marketplace/${tokenId}?intent=list#launch`), 1800);
    return () => window.clearTimeout(timer);
  }, [phase, router, tokenId]);

  const contractMissing = RWA_ADDRESS === "0x0000000000000000000000000000000000000000";
  const wrongNetwork = chainId !== xlayerTestnet.id;
  const canMint = Boolean(report?.mintEligible && evaluationToken && generatedImage && imageToken && isConnected && !wrongNetwork && !contractMissing);
  const step = phase === "underwriting" ? 2 : phase === "image" || phase === "review" || phase === "error" ? 3 : phase === "minting" ? 4 : phase === "confirmed" ? 5 : 1;

  return <div className="page-frame asset-origin-page">
    <RouteHero eyebrow="Asset origination / private evaluation" title={<>Build a digital<br/>property twin.</>} description="Photograph a lawful physical item. Gemini identifies it, values it conservatively, creates a gallery-grade twin, and binds the final record on X Layer." aside={<><RouteMetric label="Evidence" value="Photo first"/><RouteMetric label="Supply" value="1M shares" tone="amber"/><RouteMetric label="Network" value="X Layer 1952" tone="green"/></>} />
    <div className="protocol-steps">{["Capture", "Underwrite", "Twin", "Mint", "Liquidity"].map((label, index) => <span key={label} className={step > index ? "active" : ""}>{String(index + 1).padStart(2, "0")} / {label}</span>)}</div>
    {!isConnected && <Notice tone="warning">Connect a wallet before minting. You can still preview underwriting and the generated twin.</Notice>}
    {isConnected && wrongNetwork && <div className="glass-panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-amber-200"><span>Switch to X Layer Testnet before signing.</span><AddNetworkButton /></div>}
    {contractMissing && <Notice tone="warning">The registry contract address is not configured.</Notice>}
    {(phase === "idle" || phase === "underwriting") && <div className="origin-studio-grid"><UploadDropzone onFile={onFile} onImage={() => undefined} loading={phase === "underwriting"} /><aside className="origin-privacy-panel glass-panel"><div className="privacy-orbit"><span>◎</span></div><p className="kicker">Privacy boundary</p><h2>One photo. No confidential deed required.</h2><p>The source is evaluated in memory. If Gemini image generation is unavailable, the photo is stripped of metadata, resized, converted to WebP, and used as the public NFT visual.</p><div className="privacy-ledger"><span><b>01</b> Recognition</span><span><b>02</b> Conservative valuation</span><span><b>03</b> Tamper-evident hash</span></div></aside></div>}
    {report && <div className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
      <UnderwritingReport report={report} />
      <div className="asset-twin-panel glass-panel">
        <div className="asset-twin-header"><div><p className="kicker">Gemini asset twin</p><h2>{phase === "image" ? "Constructing the property portrait…" : generatedImage ? "Review before mint" : "Twin unavailable"}</h2></div>{generatedImage && <span className="status-dot">{generatedImage.status.replace("_", " ")}</span>}</div>
        <div className={`asset-twin-stage ${phase === "image" ? "is-loading" : ""}`}>{generatedImage ? <Image src={generatedImage.uri} alt={`Generated digital twin of ${report.asset.name}`} fill sizes="(max-width: 1024px) 100vw, 42vw" unoptimized /> : <div className="asset-twin-empty"><span>✦</span><p>{report.mintEligible ? "Image generation needs a retry." : "Only approved assets receive a token image."}</p></div>}<div className="asset-twin-scan" /></div>
        <p className="mt-4 text-xs leading-5 text-white/42">The twin is a visual representation, not ownership evidence. If Gemini is unavailable, an image upload is sanitized, stripped of metadata, converted to WebP, and used as the public NFT image.</p>
        {generatedImage?.fallbackReason && <div className="twin-advisory">{generatedImage.fallbackReason}</div>}
        {generatedImage?.storageWarning && <div className="twin-advisory is-warning">{generatedImage.storageWarning}</div>}
        <div className="mt-5 flex flex-wrap gap-3">{report.mintEligible && generatedImage && imageAttempt < 2 && <button className="button button-ghost" onClick={() => generateTwin(report, evaluationToken, 2)} disabled={phase === "image"}>Regenerate once ↻</button>}<button className="button button-primary" disabled={!canMint || phase === "minting" || txPending} onClick={onMint}>{phase === "minting" || txPending ? "Minting on X Layer…" : "Approve twin & mint ↗"}</button></div>
      </div>
    </div>}
    {error && <div className="mt-5"><Notice tone="error">{error}</Notice>{report?.mintEligible && !generatedImage && <button className="button button-ghost mt-3" onClick={() => generateTwin(report, evaluationToken, imageAttempt)}>Retry image generation</button>}</div>}
    {report && report.decision !== "approved" && <div className="mt-5"><Notice tone="warning">This upload cannot be minted. Use one clear, original photo with the entire physical asset visible and no people or unrelated objects.</Notice><button className="button button-ghost mt-3" onClick={() => { setReport(null); setPhase("idle"); setError(""); }}>Try another asset</button></div>}
    {phase === "confirmed" && <div className="mint-confirmation"><div className="mint-confirmation-orb">✦</div><p className="kicker">Asset #{tokenId} confirmed</p><h2>Your digital property is built.</h2><p>Opening the liquidity desk so you can list it with the required 10 USDC_TEST seed.</p>{txHash && <a href={explorerTx(xlayerTestnet.id, txHash)} target="_blank" rel="noreferrer">View transaction ↗</a>}</div>}
  </div>;
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "warning" | "error" }) { return <div className={`glass-panel mb-4 p-4 text-sm ${tone === "error" ? "text-red-200" : "text-amber-100"}`}>{children}</div>; }
