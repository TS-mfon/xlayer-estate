"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { formatUsd, riskLabel, shortAddress } from "@/lib/format";
import { RWA_ADDRESS, explorerToken, metadataGateway } from "@/lib/config";
import type { AssetMetadata } from "@/lib/types";
import type { AssetInfo } from "@/lib/asset-info";

export type { AssetInfo } from "@/lib/asset-info";
const STATUS = ["Pending", "Active", "Flagged", "Retired"];

export function AssetCard({ id, info, chainId, balance, listed, wallet }: { id: bigint; info: AssetInfo; chainId: number; balance?: bigint; listed?: boolean; wallet?: string }) {
  const risk = riskLabel(info.riskScore); const [metadata, setMetadata] = useState<AssetMetadata | null>(null); const metadataUrl = metadataGateway(info.metadataURI);
  useEffect(() => { let cancelled = false; fetch(metadataUrl).then((response) => response.ok ? response.json() : null).then((value: AssetMetadata | null) => { if (!cancelled) setMetadata(value); }).catch(() => undefined); return () => { cancelled = true; }; }, [metadataUrl]);
  const issuer = Boolean(wallet && info.owner.toLowerCase() === wallet.toLowerCase());
  const image = metadata?.image ? metadataGateway(metadata.image) : "";
  return <motion.article className="estate-card group" initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} whileHover={{ y: -8 }} transition={{ duration: .5 }}>
    <div className="estate-card-media">{image ? <Image src={image} alt={metadata?.name ?? `Asset ${id}`} fill sizes="(max-width: 800px) 100vw, 33vw" unoptimized /> : <div className="estate-card-placeholder">✦</div>}<div className="estate-card-glow" /><span className="estate-card-number">PROPERTY / {id.toString().padStart(4, "0")}</span><span className={`estate-card-status ${listed ? "listed" : ""}`}>{listed ? "Market live" : STATUS[info.status] ?? "Unknown"}</span></div>
    <div className="estate-card-body"><div><p className="kicker">{metadata?.attributes.find((item) => item.trait_type === "Asset category")?.value ?? "Digital property"}</p><h2>{metadata?.name ?? `Asset #${id}`}</h2><p className="estate-card-owner">Issuer {shortAddress(info.owner)} {issuer ? "· you" : ""}</p></div>
      <div className="estate-card-stats"><Stat label="AI value" value={formatUsd(info.valuationUsd)} /><Stat label="Launch" value={formatUsd(info.launchValuationUsd)} /><Stat label="Risk" value={`${info.riskScore}/100`} color={risk.color} />{balance !== undefined && <Stat label="Your shares" value={balance.toLocaleString()} />}</div>
      <div className="estate-card-actions"><a className="button button-ghost" href={metadataUrl} target="_blank" rel="noreferrer">Record</a><a className="button button-ghost" href={explorerToken(chainId, RWA_ADDRESS, id)} target="_blank" rel="noreferrer">Explorer</a><a className="button button-primary" href={`/marketplace/${id}${issuer && !listed ? "?intent=list" : ""}`}>{issuer && !listed ? "List asset" : listed ? "Trade / manage" : "View asset"} ↗</a></div>
    </div>
  </motion.article>;
}
function Stat({ label, value, color }: { label: string; value: string; color?: string }) { return <div><span>{label}</span><strong style={{ color }}>{value}</strong></div>; }
