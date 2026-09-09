// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the in-browser analytics engine.
// The dataset lives in a Web Worker as columnar typed arrays; these types
// describe what crosses the main-thread boundary (never raw typed arrays).
// ─────────────────────────────────────────────────────────────────────────────

export const PLATFORMS = [
  "Google Ads",
  "Meta Ads",
  "LinkedIn Ads",
  "YouTube",
  "TikTok",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export const DEVICES = ["Desktop", "Mobile", "Tablet"] as const;
export type Device = (typeof DEVICES)[number];

export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "Singapore",
  "UAE",
] as const;
export type Country = (typeof COUNTRIES)[number];

/** A single campaign-day record (one row of the dataset). */
export interface AnalyticsRecord {
  /** Days since Unix epoch — compact for storage; formatted for display. */
  day: number;
  campaignId: string;
  campaignName: string;
  platform: Platform;
  country: Country;
  device: Device;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
}

/** Metadata about the loaded dataset (returned by the worker's `init` message). */
export interface DatasetMeta {
  rowCount: number;
  /** [minDay, maxDay] inclusive, as days since epoch. */
  dayRange: [number, number];
  campaigns: CampaignMeta[];
  generatedAtMs: number;
  /** Wall-clock ms spent generating the dataset inside the worker. */
  generationMs: number;
  /** Approximate in-memory footprint of the columnar arrays, in bytes. */
  approxBytes: number;
}

export interface CampaignMeta {
  id: string;
  name: string;
  platform: Platform;
}

// ── Filters ──────────────────────────────────────────────────────────────────

export type DateRangePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "ytd"
  | "custom";

export interface FilterState {
  preset: DateRangePreset;
  /** Explicit bounds as days since epoch. Always set after applying a preset. */
  startDay: number;
  endDay: number;
  platforms: Platform[];
  countries: Country[];
  devices: Device[];
  campaigns: string[];
  minSpend: number | null;
  minRevenue: number | null;
}

/** Serializable worker request. Every query carries its own filter snapshot. */
export interface AnalyticsQuery extends FilterState {
  search: string;
  sortBy: SortableColumn;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}

export type SortableColumn =
  | "day"
  | "campaignName"
  | "platform"
  | "country"
  | "device"
  | "impressions"
  | "clicks"
  | "conversions"
  | "spend"
  | "revenue"
  | "ctr"
  | "conversionRate"
  | "cpc"
  | "cpa"
  | "roas";

export type SortDirection = "asc" | "desc";

// ── Server-shaped responses (mirror the documented REST contract) ────────────

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

/** Aggregated row for the table: computed metrics are derived at query time. */
export interface TableRow extends AnalyticsRecord {
  ctr: number; // 0..1
  conversionRate: number; // 0..1
  cpc: number;
  cpa: number;
  roas: number;
}

// ── Aggregations ─────────────────────────────────────────────────────────────

export interface Totals {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  rowCount: number;
  activeDays: number;
}

export interface Kpi extends Totals {
  /** Averaged over active days; 0 when the window has no rows. */
  avgCtr: number;
  avgConversionRate: number;
  cpc: number;
  cpa: number;
  roas: number;
}

export interface TimeSeriesPoint {
  day: number;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  roas: number;
}

export interface GroupTotals {
  /** Group key: platform / country / device / campaignId */
  key: string;
  label: string;
  platform?: Platform;
  country?: Country;
  device?: Device;
  campaignId?: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  conversionRate: number;
  cpc: number;
  cpa: number;
  roas: number;
}

// ── Performance monitor ──────────────────────────────────────────────────────

export interface PerfSnapshot {
  /** performance.now() delta of the last main→worker→main query round trip. */
  lastQueryMs: number;
  /** p50/p95 over the query-latency ring buffer. */
  p50QueryMs: number | null;
  p95QueryMs: number | null;
  lastSearchMs: number;
  p50SearchMs: number | null;
  p95SearchMs: number | null;
  lastRenderMs: number;
  p50RenderMs: number | null;
  p95RenderMs: number | null;
  /** performance.memory.usedJSHeapSize, when available. */
  heapUsedMb: number | null;
  heapLimitMb: number | null;
  /** HTTP latency of the last /api/health style request (worker `init`). */
  initMs: number;
  cacheHits: number;
  cacheMisses: number;
  cacheEntries: number;
  filteredRows: number;
  visibleRows: number;
  datasetRows: number;
  datasetBytes: number;
}

export type PerfStatus = "excellent" | "good" | "needs-optimization";

// ── Worker protocol ──────────────────────────────────────────────────────────

export type WorkerRequest =
  | { type: "init"; rowCount: number }
  | { type: "query"; id: number; query: AnalyticsQuery }
  | { type: "summary"; id: number; filters: FilterState }
  | { type: "timeseries"; id: number; filters: FilterState; granularity: "day" | "week" }
  | { type: "breakdown"; id: number; filters: FilterState; dimension: BreakdownDimension; limit?: number }
  | { type: "campaign"; id: number; campaignId: string; filters: FilterState }
  | { type: "csv"; id: number; query: AnalyticsQuery; offset: number; limit: number }
  | { type: "clearCache"; id: number };

export type BreakdownDimension = "platform" | "country" | "device" | "campaign";

export interface WorkerResponseMeta {
  /** Wall-clock ms spent processing this request in the worker. */
  processingMs: number;
  cacheHit: boolean;
}

export interface WorkerSummaryResponse {
  kpi: Kpi;
  deltaPct: Record<string, number>;
  filteredRows: number;
}

export type WorkerResponse =
  | { type: "ready"; meta: DatasetMeta }
  | ({ type: "query"; id: number; rows: TableRow[]; pagination: Pagination; filteredRows: number } & WorkerResponseMeta)
  | ({ type: "summary"; id: number } & WorkerSummaryResponse & WorkerResponseMeta)
  | ({ type: "timeseries"; id: number; points: TimeSeriesPoint[] } & WorkerResponseMeta)
  | ({ type: "breakdown"; id: number; groups: GroupTotals[] } & WorkerResponseMeta)
  | ({ type: "campaign"; id: number; totals: Kpi; series: TimeSeriesPoint[] } & WorkerResponseMeta)
  | ({
      type: "csv";
      id: number;
      text: string;
      offset: number;
      totalRows: number;
      done: boolean;
    } & WorkerResponseMeta)
  | ({ type: "ack"; id: number } & WorkerResponseMeta)
  | { type: "error"; id: number; message: string };
