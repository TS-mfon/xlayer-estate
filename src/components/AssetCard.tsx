import { formatUsd, riskLabel, shortAddress } from "@/lib/format";
import { RWA_ADDRESS, explorerToken, metadataGateway } from "@/lib/config";

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
    <div className="glass-panel group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/25">
      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-cyan-300/20" />
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
            className="button button-ghost !min-h-8 !py-1.5 !text-xs"
            href={metadataGateway(info.metadataURI)}
            target="_blank"
            rel="noreferrer"
          >
            AI Report
          </a>
        )}
        <a
          className="button button-ghost !min-h-8 !py-1.5 !text-xs"
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
