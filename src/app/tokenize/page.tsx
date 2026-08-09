"use client";

import { useEffect, useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnderwritingReport } from "@/components/UnderwritingReport";
import { AddNetworkButton } from "@/components/AddNetworkButton";
import { rwaAbi } from "@/lib/abi";
import { RWA_ADDRESS, TOTAL_SHARES, explorerTx } from "@/lib/config";
import { xlayerTestnet } from "@/lib/chains";
import type { UnderwritingReport as Report } from "@/lib/types";

type Phase = "idle" | "underwriting" | "ready" | "minting" | "done" | "error";

export default function TokenizePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string>("");
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [tokenId, setTokenId] = useState<string>("");

  const { isLoading: txPending, isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const onFile = async (file: File) => {
    setPhase("underwriting");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/underwrite", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Underwriting failed");
      const data = (await res.json()) as Report;
      setReport(data);
      setPhase("ready");
    } catch (e: any) {
      setError(e?.message ?? "Underwriting failed");
      setPhase("error");
    }
  };

  const onMint = async () => {
    if (!report || !address) return;
    setPhase("minting");
    setError("");
    try {
      const meta = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
      const { hash, uri } = (await meta.json()) as { hash: `0x${string}`; uri: string };

      const hash_ = await writeContractAsync({
        address: RWA_ADDRESS,
        abi: rwaAbi,
        functionName: "tokenizeProperty",
        args: [
          address,
          BigInt(Math.round(report.valuationUsd)),
          Number(report.riskScore),
          hash,
          uri,
          TOTAL_SHARES,
        ],
      });
      setTxHash(hash_);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? "Mint failed");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (txConfirmed) setPhase("done");
  }, [txConfirmed]);

  const contractMissing =
    RWA_ADDRESS === "0x0000000000000000000000000000000000000000";
  const wrongNetwork = chainId !== xlayerTestnet.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tokenize a property</h1>
        <p className="text-white/60">
          Upload a real-estate document to generate an AI underwriting report, then mint it as an
          RWA token on X Layer.
        </p>
      </div>

      {!isConnected && (
        <div className="glass rounded-xl p-4 text-sm text-amber-200">
          Connect your wallet (top-right) to begin.
        </div>
      )}
      {isConnected && wrongNetwork && (
        <div className="glass flex items-center justify-between rounded-xl p-4 text-sm text-amber-200">
          <span>Please switch to X Layer Testnet to mint.</span>
          <AddNetworkButton />
        </div>
      )}
      {contractMissing && (
        <div className="glass rounded-xl p-4 text-sm text-amber-200">
          Contract not deployed yet. Run <code>npm run deploy:testnet</code> and set{" "}
          <code>NEXT_PUBLIC_RWA_ADDRESS</code> in <code>.env.local</code>. You can still preview
          the AI underwriting below.
        </div>
      )}

      {phase === "idle" || phase === "underwriting" ? (
        <UploadDropzone onFile={onFile} loading={phase === "underwriting"} />
      ) : report ? (
        <div className="space-y-4">
          <UnderwritingReport report={report} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="btn btn-primary"
              disabled={!isConnected || wrongNetwork || contractMissing || phase === "minting"}
              onClick={onMint}
            >
              {phase === "minting" || txPending ? "Minting…" : "Mint RWA token"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setReport(null); setPhase("idle"); }}>
              Upload another
            </button>
            {txHash && (
              <a
                className="text-sm text-brand-glow"
                href={explorerTx(chainId, txHash)}
                target="_blank"
                rel="noreferrer"
              >
                View tx ↗
              </a>
            )}
          </div>
          {phase === "done" && (
            <div className="glass rounded-xl p-4 text-sm text-emerald-300">
              ✅ Token minted on X Layer Testnet. See it on the{" "}
              <a className="underline" href="/dashboard">
                Dashboard
              </a>
              .
            </div>
          )}
          {phase === "error" && error && (
            <div className="glass rounded-xl p-4 text-sm text-red-300">⚠️ {error}</div>
          )}
        </div>
      ) : (
        <div className="glass rounded-xl p-4 text-sm text-red-300">⚠️ {error || "Something went wrong."}</div>
      )}
    </div>
  );
}
