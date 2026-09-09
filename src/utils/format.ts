const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const int0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.2M", "45.3K" — KPI cards and axes. */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return compact.format(n);
}

/** "1,234,567" — tooltips and detail views. */
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return int0.format(Math.round(n));
}

/** "1,234.56" — currency amounts without the symbol (symbol added by caller). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return dec1.format(n);
}

/** "$12.3K" style currency. */
export function formatCurrency(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${compact.format(n)}`;
}

/** "$1,234.56" — exact currency for tooltips. */
export function formatCurrencyFull(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${dec1.format(n)}`;
}

/** "3.42%" — rate metrics stored as 0..1. */
export function formatPercent(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** "2.4x" — ROAS. */
export function formatRoas(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}x`;
}

/** Signed percentage change, e.g. "+12.4%" / "−3.1%". */
export function formatDelta(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

/** "$4.21" style exact CPC/CPA. */
export function formatUsd2(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)}`;
}

/** Bytes → "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10));
  return `${(bytes / 2 ** (10 * i)).toFixed(1)} ${units[i]}`;
}

/** ms → "12.4 ms" or "1.20 s". */
export function formatMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(1)} ms`;
}
