import type { UnderwritingReport } from "@/lib/types";
import { formatUsd, riskLabel } from "@/lib/format";

export function UnderwritingReport({ report }: { report: UnderwritingReport }) {
  const risk = riskLabel(report.riskScore);
  return (
    <div className="glass-panel relative overflow-hidden p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{report.asset.name}</h3>
          <p className="text-sm text-white/60">{report.asset.category} · {report.asset.condition} · {report.asset.brand} {report.asset.model}</p>
        </div>
        {report.mock && (
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
            AI mock (no key)
          </span>
        )}
      </div>

      {report.fallbackReason && (
        <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.06] px-3 py-2 text-xs text-amber-100/80">
          {report.fallbackReason}
        </p>
      )}

      <div className={`mt-4 rounded-xl border px-3 py-2 text-xs ${report.decision === "approved" ? "border-emerald-300/20 bg-emerald-300/[.07] text-emerald-100" : report.decision === "rejected" ? "border-red-300/20 bg-red-300/[.07] text-red-100" : "border-amber-300/20 bg-amber-300/[.07] text-amber-100"}`}>
        <span className="font-semibold uppercase tracking-[.15em]">{report.decision.replace("_", " ")}</span>
        <span className="ml-3">Evidence {report.assetEvidenceScore}/100 · Authenticity {report.authenticityScore}/100 · Confidence {report.valuationConfidence}/100</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="AI Valuation" value={formatUsd(report.valuationUsd)} />
        <Stat label="Launch Valuation" value={formatUsd(report.launchValuationUsd)} />
        <Stat
          label="Range"
          value={`${formatUsd(report.valuationRange[0])} – ${formatUsd(
            report.valuationRange[1]
          )}`}
        />
        <Stat label="Identifier" value={report.asset.identifier} />
        <Stat label="Ownership" value="Self-attested / not verified" />
      </div>

      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-white/60">Underwriting Risk Score</span>
          <span style={{ color: risk.color }} className="font-semibold">
            {report.riskScore}/100 · {risk.text}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${report.riskScore}%`, background: risk.color }}
          />
        </div>
        {report.riskFlags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {report.riskFlags.map((f) => (
              <span
                key={f}
                className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-300"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-white/70">{report.summary}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[.035] p-3 transition hover:border-cyan-200/20 hover:bg-cyan-200/[.04]">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
