import { DEVICES, PLATFORMS, COUNTRIES } from "@/types/analytics";
import type {
  AnalyticsQuery,
  Pagination,
  TableRow,
} from "@/types/analytics";
import { AnalyticsStore } from "./store";
import { dayToISO } from "@/utils/date";

// ─────────────────────────────────────────────────────────────────────────────
// Query engine: search → sort → paginate over store-compiled row indices.
// Sorting happens on the filtered index array (not on row objects), so a
// page-sized materialization follows — the O(n log n) sort never touches more
// than the filtered set, and only `pageSize` rows become JS objects.
// ─────────────────────────────────────────────────────────────────────────────

export class AnalyticsEngine {
  readonly store: AnalyticsStore;
  private cachedSortKey: string | null = null;
  private cachedSortView: number[] = [];

  constructor(rowCount: number, startDay: number, endDay: number, seed = 20260909) {
    this.store = new AnalyticsStore(rowCount, startDay, endDay, seed);
  }

  get meta() {
    return {
      rowCount: this.store.rowCount,
      dayRange: [this.store.dayMin, this.store.dayMax] as [number, number],
      campaigns: this.store.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
      })),
      generatedAtMs: this.store.generatedAtMs,
      generationMs: this.store.generationMs,
      approxBytes: this.store.approxBytes,
    };
  }

  private rowObject(i: number): TableRow {
    const c = this.store.columns;
    const ci = c.campaign[i];
    const imp = c.impressions[i];
    const clk = c.clicks[i];
    const cnv = c.conversions[i];
    const spd = c.spend[i];
    const rev = c.revenue[i];
    return {
      day: c.day[i],
      campaignId: this.store.campaignIds[ci],
      campaignName: this.store.campaignNames[ci],
      platform: this.store.campaigns[ci].platform,
      country: COUNTRIES[c.country[i]],
      device: DEVICES[c.device[i]],
      impressions: imp,
      clicks: clk,
      conversions: cnv,
      spend: spd,
      revenue: rev,
      ctr: imp > 0 ? clk / imp : 0,
      conversionRate: clk > 0 ? cnv / clk : 0,
      cpc: clk > 0 ? spd / clk : 0,
      cpa: cnv > 0 ? spd / cnv : 0,
      roas: spd > 0 ? rev / spd : 0,
    };
  }

  /**
   * Search + sort the filtered index set. Results are memoized while the
   * (filterKey, search, sortBy, sortDir) tuple is unchanged so pagination
   * pages through the same sorted view.
   */
  private materializeView(q: AnalyticsQuery): number[] {
    const cacheKey = [
      this.store.filterKey(q),
      q.search.trim().toLowerCase(),
      q.sortBy,
      q.sortDir,
    ].join("::");

    if (this.cachedSortKey === cacheKey) return this.cachedSortView;

    const indices = this.store.compileFilter(q);
    const colCampaign = this.store.columns.campaign;

    let view: number[];
    const needle = q.search.trim().toLowerCase();
    if (needle) {
      // Precompute per-campaign hit flags once, then test rows in O(1).
      const hits = new Uint8Array(this.store.campaignSearch.length);
      let anyHit = false;
      for (let ci = 0; ci < this.store.campaignSearch.length; ci++) {
        if (this.store.campaignSearch[ci].includes(needle)) {
          hits[ci] = 1;
          anyHit = true;
        }
      }
      if (!anyHit) {
        view = [];
      } else {
        const out: number[] = [];
        for (let k = 0; k < indices.length; k++) {
          const i = indices[k];
          if (hits[colCampaign[i]]) out.push(i);
        }
        view = out;
      }
    } else {
      view = Array.from(indices);
    }

    const dir = q.sortDir === "asc" ? 1 : -1;
    const names = this.store.campaignNames;
    const c = this.store.columns;

    // Precompute the sort key array to keep the comparator numeric.
    const n = view.length;
    const keys = new Array<number | string>(n);
    switch (q.sortBy) {
      case "campaignName":
        for (let k = 0; k < n; k++) keys[k] = names[c.campaign[view[k]]];
        break;
      case "platform":
        for (let k = 0; k < n; k++) keys[k] = this.store.campaigns[c.campaign[view[k]]].platform;
        break;
      case "country":
        for (let k = 0; k < n; k++) keys[k] = COUNTRIES[c.country[view[k]]];
        break;
      case "device":
        for (let k = 0; k < n; k++) keys[k] = DEVICES[c.device[view[k]]];
        break;
      case "impressions":
        for (let k = 0; k < n; k++) keys[k] = c.impressions[view[k]];
        break;
      case "clicks":
        for (let k = 0; k < n; k++) keys[k] = c.clicks[view[k]];
        break;
      case "conversions":
        for (let k = 0; k < n; k++) keys[k] = c.conversions[view[k]];
        break;
      case "spend":
        for (let k = 0; k < n; k++) keys[k] = c.spend[view[k]];
        break;
      case "revenue":
        for (let k = 0; k < n; k++) keys[k] = c.revenue[view[k]];
        break;
      case "ctr":
        for (let k = 0; k < n; k++) keys[k] = c.impressions[view[k]] > 0 ? c.clicks[view[k]] / c.impressions[view[k]] : 0;
        break;
      case "conversionRate":
        for (let k = 0; k < n; k++) keys[k] = c.clicks[view[k]] > 0 ? c.conversions[view[k]] / c.clicks[view[k]] : 0;
        break;
      case "cpc":
        for (let k = 0; k < n; k++) keys[k] = c.clicks[view[k]] > 0 ? c.spend[view[k]] / c.clicks[view[k]] : 0;
        break;
      case "cpa":
        for (let k = 0; k < n; k++) keys[k] = c.conversions[view[k]] > 0 ? c.spend[view[k]] / c.conversions[view[k]] : 0;
        break;
      case "roas":
        for (let k = 0; k < n; k++) keys[k] = c.spend[view[k]] > 0 ? c.revenue[view[k]] / c.spend[view[k]] : 0;
        break;
      default: // "day"
        for (let k = 0; k < n; k++) keys[k] = c.day[view[k]];
        break;
    }

    // Decorate–sort–undecorate with a stable tiebreak on the original index.
    const decorated = view
      .map((rowIndex, k) => ({ rowIndex, key: keys[k] }))
      .sort((a, b) => {
        const av = a.key;
        const bv = b.key;
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return a.rowIndex - b.rowIndex;
      });

    const result = decorated.map((d) => d.rowIndex);
    this.cachedSortKey = cacheKey;
    this.cachedSortView = result;
    return result;
  }

  query(q: AnalyticsQuery): { rows: TableRow[]; pagination: Pagination } {
    const view = this.materializeView(q);
    const pageSize = Math.max(1, Math.min(1000, q.pageSize));
    const start = Math.max(0, (q.page - 1) * pageSize);
    const end = Math.min(view.length, start + pageSize);

    const rows: TableRow[] = [];
    for (let k = start; k < end; k++) rows.push(this.rowObject(view[k]));

    return {
      rows,
      pagination: {
        page: q.page,
        pageSize,
        total: view.length,
        totalPages: Math.max(1, Math.ceil(view.length / pageSize)),
      },
    };
  }

  /** Length of the filtered + searched view (ignores pagination). */
  viewLength(query: AnalyticsQuery): number {
    return this.materializeView(query).length;
  }

  /**
   * CSV rows for [startRow, startRow + maxRows) of the sorted, filtered view.
   * The worker calls this repeatedly with advancing offsets so the export
   * streams without ever materializing 100k rows in one message.
   */
  csvRows(query: AnalyticsQuery, startRow: number, maxRows: number): string[][] {
    const view = this.materializeView(query);
    const c = this.store.columns;
    const end = Math.min(view.length, startRow + maxRows);

    const out: string[][] = [];
    for (let k = startRow; k < end; k++) {
      const i = view[k];
      const ci = c.campaign[i];
      const imp = c.impressions[i];
      const clk = c.clicks[i];
      const cnv = c.conversions[i];
      const spd = c.spend[i];
      const rev = c.revenue[i];
      out.push([
        dayToISO(c.day[i]),
        this.store.campaignIds[ci],
        this.store.campaignNames[ci],
        this.store.campaigns[ci].platform,
        COUNTRIES[c.country[i]],
        DEVICES[c.device[i]],
        String(Math.round(imp)),
        String(clk),
        String(cnv),
        spd.toFixed(2),
        rev.toFixed(2),
        (imp > 0 ? clk / imp : 0).toFixed(6),
        (clk > 0 ? cnv / clk : 0).toFixed(6),
        (clk > 0 ? spd / clk : 0).toFixed(4),
        (cnv > 0 ? spd / cnv : 0).toFixed(4),
        (spd > 0 ? rev / spd : 0).toFixed(4),
      ]);
    }
    return out;
  }
}

// ── CSV streaming helpers ────────────────────────────────────────────────────

export const CSV_HEADER = [
  "date", "campaign_id", "campaign_name", "platform", "country", "device",
  "impressions", "clicks", "conversions", "spend", "revenue", "ctr",
  "conversion_rate", "cpc", "cpa", "roas",
];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize one chunk of rows into a CSV text block (no trailing newline). */
export function serializeCsvRows(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

export { PLATFORMS };
