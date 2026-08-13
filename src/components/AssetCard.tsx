"use client";

import { useEffect, useState } from "react";
import { formatUsd, riskLabel, shortAddress } from "@/lib/format";
import { RWA_ADDRESS, explorerToken, metadataGateway } from "@/lib/config";

export type AssetInfo = {
  owner: string;
  valuationUsd: bigint;
  launchValuationUsd?: bigint;
  totalShares?: bigint;
  riskScore: number;
  status: number;
  underwritingHash: string;
  metadataHash?: string;
  metadataURI: string;
  timestamp: bigint;
};

const STATUS = ["Pending", "Active", "Flagged", "Retired"];

export function AssetCard({ id, info, chainId }: { id: bigint; info: AssetInfo; chainId: number }) {
  const risk = riskLabel(info.riskScore);
  const [image, setImage] = useState<string>("");
  const metadataUrl = metadataGateway(info.metadataURI);
  useEffect(() => {
    let cancelled = false;
    fetch(metadataUrl).then((response) => response.ok ? response.json() : null).then((metadata: { image?: string } | null) => { if (!cancelled && metadata?.image) setImage(metadata.image.startsWith("ipfs://") ? metadataGateway(metadata.image) : metadata.image); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [metadataUrl]);
  return (
    <div className="glass-panel group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25">
      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
      {image && <img src={image} alt="Tokenized physical asset" className="mb-5 aspect-[1.9] w-full rounded-xl border border-white/10 object-cover" />}
      <div className="flex items-center justify-between"><span className="font-mono text-xs text-white/50">Asset #{id.toString()}</span><span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">{STATUS[info.status] ?? "Unknown"}</span></div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><div className="text-white/50">AI valuation</div><div className="font-semibold">{formatUsd(info.valuationUsd)}</div></div><div><div className="text-white/50">Launch value</div><div className="font-semibold">{formatUsd(info.launchValuationUsd ?? info.valuationUsd)}</div></div><div><div className="text-white/50">Risk</div><div className="font-semibold" style={{ color: risk.color }}>{info.riskScore}/100</div></div><div><div className="text-white/50">Owner</div><div className="font-mono text-xs">{shortAddress(info.owner)}</div></div></div>
      <div className="mt-4 flex flex-wrap gap-2"><a className="button button-ghost !min-h-8 !py-1.5 !text-xs" href={metadataUrl} target="_blank" rel="noreferrer">AI Report</a><a className="button button-ghost !min-h-8 !py-1.5 !text-xs" href={explorerToken(chainId, RWA_ADDRESS, id)} target="_blank" rel="noreferrer">Explorer</a><a className="button button-primary !min-h-8 !py-1.5 !text-xs" href={`/marketplace/${id}`}>Trade</a></div>
    </div>
  );
}
