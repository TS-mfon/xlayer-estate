import type { UnderwritingReport } from "@/lib/types";
import { formatUsd, riskLabel } from "@/lib/format";

export function UnderwritingReport({ report }: { report: UnderwritingReport }) {
  const risk = riskLabel(report.riskScore);
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{report.property.address}</h3>
          <p className="text-sm text-white/60">
            {report.property.type} · {report.property.areaSqm} m² · {report.property.rooms} rooms
          </p>
        </div>
        {report.mock && (
          <span className="rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
            AI mock (no key)
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="AI Valuation" value={formatUsd(report.valuationUsd)} />
        <Stat
          label="Range"
          value={`${formatUsd(report.valuationRange[0])} – ${formatUsd(
            report.valuationRange[1]
          )}`}
        />
        <Stat label="Title Status" value={report.property.titleStatus} />
        <Stat label="Owner" value={report.property.owner} />
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
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}
