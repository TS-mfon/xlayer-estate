export function shortAddress(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatUsd(n: number | bigint) {
  const v = typeof n === "bigint" ? Number(n) : n;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

export function formatPrice(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(8)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
}

export function formatPercent(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "New market";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function riskLabel(score: number) {
  if (score <= 20) return { text: "Low", color: "#3fb950" };
  if (score <= 45) return { text: "Moderate", color: "#d29922" };
  if (score <= 70) return { text: "Elevated", color: "#f0883e" };
  return { text: "High", color: "#f85149" };
}
