import { DATE_PRESETS, DATASET_DAYS } from "@/lib/constants";
import type { DateRangePreset, FilterState } from "@/types/analytics";

const DAY_MS = 86_400_000;

/** Days since Unix epoch for a JS date (UTC-anchored day buckets). */
export function toDay(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** JS Date from days since epoch. */
export function fromDay(day: number): Date {
  return new Date(day * DAY_MS);
}

/** Today's day-number, minus an offset. */
export function todayDay(offsetDays = 0): number {
  return toDay(new Date()) - offsetDays;
}

/** Absolute end of the generated dataset: yesterday, so "today" has a previous period. */
export function datasetEndDay(): number {
  return todayDay(1);
}

/** Absolute start of the generated dataset. */
export function datasetStartDay(): number {
  return datasetEndDay() - DATASET_DAYS + 1;
}

/** Resolve a preset to concrete [startDay, endDay] bounds, clamped to the dataset. */
export function resolvePreset(preset: DateRangePreset, startDay?: number, endDay?: number): { startDay: number; endDay: number } {
  const end = endDay ?? datasetEndDay();
  const dsStart = datasetStartDay();

  if (preset === "custom" && startDay != null) {
    return { startDay: Math.max(dsStart, startDay), endDay: Math.min(end, end) };
  }

  switch (preset) {
    case "today":
      return { startDay: end, endDay: end };
    case "ytd": {
      const now = fromDay(end);
      const jan1 = toDay(new Date(now.getFullYear(), 0, 1));
      return { startDay: Math.max(dsStart, jan1), endDay: end };
    }
    default: {
      const entry = DATE_PRESETS.find((p) => p.value === preset);
      const days = entry?.days ?? 30;
      return { startDay: Math.max(dsStart, end - days + 1), endDay: end };
    }
  }
}

/** Number of days in [startDay, endDay] inclusive. */
export function spanDays(startDay: number, endDay: number): number {
  return Math.max(1, endDay - startDay + 1);
}

/**
 * The equally-sized "previous period" window immediately before [start, end].
 * Used for KPI % change.
 */
export function previousPeriod(startDay: number, endDay: number): { startDay: number; endDay: number } {
  const span = spanDays(startDay, endDay);
  return { startDay: startDay - span, endDay: startDay - 1 };
}

// ── Formatting ───────────────────────────────────────────────────────────────

const fmtDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const fmtDateYear = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-US", { month: "short" });

/** "Mar 14" — axis/tooltip label for a day bucket. */
export function formatDay(day: number): string {
  return fmtDate.format(fromDay(day));
}

/** "Mar 14, 2024" — full date for tables. */
export function formatDayFull(day: number): string {
  return fmtDateYear.format(fromDay(day));
}

/** "Mar" — month label from a day number. */
export function formatMonth(day: number): string {
  return fmtMonth.format(fromDay(day));
}

/** "Mar 3 – Mar 30" style range label for the header control. */
export function formatRangeLabel(startDay: number, endDay: number): string {
  return `${fmtDate.format(fromDay(startDay))} – ${fmtDateYear.format(fromDay(endDay))}`;
}

/** ISO yyyy-mm-dd from a day number (for date inputs). */
export function dayToISO(day: number): string {
  return fromDay(day).toISOString().slice(0, 10);
}

/** Parse yyyy-mm-dd (from a date input) into a day number. */
export function isoToDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return NaN;
  return toDay(new Date(y, m - 1, d));
}

/** Build a FilterState for a preset (used on first load and preset switches). */
export function filterStateFromPreset(
  preset: DateRangePreset,
  base?: Partial<FilterState>,
): FilterState {
  const { startDay, endDay } = resolvePreset(preset);
  return {
    preset,
    startDay,
    endDay,
    platforms: [],
    countries: [],
    devices: [],
    campaigns: [],
    minSpend: null,
    minRevenue: null,
    ...base,
  };
}

/** Count of non-date filters currently applied. */
export function activeFilterCount(f: FilterState): number {
  return (
    f.platforms.length +
    f.countries.length +
    f.devices.length +
    f.campaigns.length +
    (f.minSpend != null ? 1 : 0) +
    (f.minRevenue != null ? 1 : 0)
  );
}
