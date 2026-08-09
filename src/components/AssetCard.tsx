import { formatUsd, riskLabel, shortAddress } from "@/lib/format";
import { RWA_ADDRESS, explorerToken } from "@/lib/config";

export type AssetInfo = {
  owner: string;
  valuationUsd: bigint;
  riskScore: number;
  status: number;
  underwritingHash: string;
  metadataURI: string;
  timestamp: bigint;
};

const STATUS = ["Pending", "Active", "Flagged", "Retired"];

export function AssetCard({
  id,
  info,
  chainId,
}: {
  id: bigint;
  info: AssetInfo;
  chainId: number;
}) {
  const risk = riskLabel(info.riskScore);
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-white/50">Asset #{id.toString()}</span>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
          {STATUS[info.status] ?? "Unknown"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-white/50">Valuation</div>
          <div className="font-semibold">{formatUsd(info.valuationUsd)}</div>
        </div>
        <div>
          <div className="text-white/50">Risk</div>
          <div className="font-semibold" style={{ color: risk.color }}>
            {info.riskScore}/100
          </div>
        </div>
        <div className="col-span-2">
          <div className="text-white/50">Owner</div>
          <div className="font-mono text-xs">{shortAddress(info.owner)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {info.metadataURI && (
          <a
            className="btn btn-ghost !py-1.5 !text-xs"
            href={info.metadataURI}
            target="_blank"
            rel="noreferrer"
          >
            AI Report
          </a>
        )}
        <a
          className="btn btn-ghost !py-1.5 !text-xs"
          href={explorerToken(chainId, RWA_ADDRESS, id)}
          target="_blank"
          rel="noreferrer"
        >
          Explorer
        </a>
      </div>
    </div>
  );
}
