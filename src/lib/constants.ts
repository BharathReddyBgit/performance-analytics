import type { DateRangePreset, Platform, SortableColumn } from "@/types/analytics";

/** Default dataset size. Configurable per session in Settings (10k–200k). */
export const DEFAULT_DATASET_ROWS = 60_000;
export const MIN_DATASET_ROWS = 10_000;
export const MAX_DATASET_ROWS = 200_000;

export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;

/** CSV export streams this many rows per postMessage chunk. */
export const CSV_CHUNK_SIZE = 5_000;

/** Debounce (ms) for search input before it reaches the engine. */
export const SEARCH_DEBOUNCE_MS = 250;

/** Ring-buffer size for latency percentiles on the Performance Monitor. */
export const LATENCY_SAMPLES = 200;

/** Generator span: ~18 months of campaign history ending yesterday. */
export const DATASET_DAYS = 545;

export const DATE_PRESETS: { value: DateRangePreset; label: string; days: number }[] = [
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "ytd", label: "This year", days: 0 },
];

/** Chart metric switcher options (Campaign Performance bar chart). */
export const BAR_METRICS = [
  { value: "revenue", label: "Revenue" },
  { value: "spend", label: "Spend" },
  { value: "clicks", label: "Clicks" },
  { value: "conversions", label: "Conversions" },
  { value: "roas", label: "ROAS" },
] as const;
export type BarMetric = (typeof BAR_METRICS)[number]["value"];

/** Default sort for the Data Explorer table. */
export const DEFAULT_SORT: { by: SortableColumn; dir: "desc" } = {
  by: "revenue",
  dir: "desc",
};

/** Axis mapping for the scatter chart (Spend vs Revenue). */
export const SCATTER_X: SortableColumn = "spend";
export const SCATTER_Y: SortableColumn = "revenue";

export const PLATFORM_LIST: Platform[] = [
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "YouTube",
  "TikTok",
];

export const DEVICE_LIST = ["Desktop", "Mobile", "Tablet"] as const;

/** Chart color assignments per platform (stable across charts). */
export const PLATFORM_COLORS: Record<Platform, string> = {
  "Google Ads": "hsl(221 83% 53%)",
  "Meta Ads": "hsl(199 89% 48%)",
  "LinkedIn Ads": "hsl(173 80% 40%)",
  YouTube: "hsl(25 95% 53%)",
  TikTok: "hsl(280 65% 60%)",
};

export const DEVICE_COLORS: Record<string, string> = {
  Desktop: "hsl(221 83% 53%)",
  Mobile: "hsl(173 80% 40%)",
  Tablet: "hsl(38 92% 50%)",
};
