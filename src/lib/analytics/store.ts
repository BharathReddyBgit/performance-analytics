import { DEVICES, PLATFORMS, COUNTRIES } from "@/types/analytics";
import type {
  BreakdownDimension,
  FilterState,
  GroupTotals,
  Kpi,
  Platform,
  TimeSeriesPoint,
  Totals,
} from "@/types/analytics";
import { generateDataset, type CampaignSeed, type DatasetColumns } from "./generator";
import { previousPeriod, spanDays } from "@/utils/date";

// ─────────────────────────────────────────────────────────────────────────────
// Columnar store over typed arrays.
//
// Rows are reordered day-ascending after generation (counting sort), which
// makes date-window scans a contiguous slice and enables the day-run index.
// Filter results are memoized in an LRU keyed by the filter state, so
// sort/search/page interactions reuse the previous scan.
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_IDX = new Map<string, number>(PLATFORMS.map((p, i) => [p, i]));
const COUNTRY_IDX = new Map<string, number>(COUNTRIES.map((c, i) => [c, i]));
const DEVICE_IDX = new Map<string, number>(DEVICES.map((d, i) => [d, i]));

const CACHE_CAP = 24;

/** Reorder all columns so rows are sorted by day (counting sort, O(n)). */
function sortByDay(cols: DatasetColumns, rowCount: number, startDay: number, daySpan: number): void {
  const counts = new Uint32Array(daySpan + 1);
  for (let i = 0; i < rowCount; i++) counts[cols.day[i] - startDay]++;
  const offsets = new Uint32Array(daySpan + 1);
  for (let d = 0; d < daySpan; d++) offsets[d + 1] = offsets[d] + counts[d];

  const out = {
    campaign: new Uint16Array(rowCount),
    country: new Uint8Array(rowCount),
    device: new Uint8Array(rowCount),
    impressions: new Float64Array(rowCount),
    clicks: new Uint32Array(rowCount),
    conversions: new Uint32Array(rowCount),
    spend: new Float64Array(rowCount),
    revenue: new Float64Array(rowCount),
  };
  const cursor = offsets.slice();
  const day = cols.day;
  for (let i = 0; i < rowCount; i++) {
    const pos = cursor[day[i] - startDay]++;
    out.campaign[pos] = cols.campaign[i];
    out.country[pos] = cols.country[i];
    out.device[pos] = cols.device[i];
    out.impressions[pos] = cols.impressions[i];
    out.clicks[pos] = cols.clicks[i];
    out.conversions[pos] = cols.conversions[i];
    out.spend[pos] = cols.spend[i];
    out.revenue[pos] = cols.revenue[i];
  }
  cols.campaign = out.campaign;
  cols.country = out.country;
  cols.device = out.device;
  cols.impressions = out.impressions;
  cols.clicks = out.clicks;
  cols.conversions = out.conversions;
  cols.spend = out.spend;
  cols.revenue = out.revenue;
}

export class AnalyticsStore {
  readonly columns: DatasetColumns;
  readonly campaigns: CampaignSeed[];
  readonly campaignNames: string[];
  readonly campaignIds: string[];
  /** Lowercased "name id" per campaign for substring search. */
  readonly campaignSearch: string[];
  readonly rowCount: number;
  readonly dayMin: number;
  readonly dayMax: number;
  readonly generatedAtMs: number;
  readonly generationMs: number;
  readonly approxBytes: number;

  /** Day-offset → first row index (0xffffffff when the day has no rows). */
  private dayFirst: Uint32Array;
  private dayLast: Uint32Array;
  private filterCache = new Map<string, Uint32Array>();
  /** True when the last compileFilter call was served from the cache. */
  lastFilterCacheHit = false;

  constructor(rowCount: number, startDay: number, endDay: number, seed = 20260909) {
    const t0 = performance.now();
    const generated = generateDataset({ rowCount, startDay, endDay, seed });
    const daySpan = endDay - startDay + 1;

    sortByDay(generated.columns, rowCount, startDay, daySpan);
    this.columns = generated.columns;
    this.campaigns = generated.campaigns;
    this.campaignNames = generated.campaigns.map((c) => c.name);
    this.campaignIds = generated.campaigns.map((c) => c.id);
    this.campaignSearch = generated.campaigns.map((c) => `${c.name} ${c.id}`.toLowerCase());
    this.rowCount = rowCount;
    this.dayMin = startDay;
    this.dayMax = endDay;

    this.dayFirst = new Uint32Array(daySpan).fill(0xffffffff);
    this.dayLast = new Uint32Array(daySpan);
    const day = this.columns.day;
    for (let i = 0; i < rowCount; i++) {
      const d = day[i] - startDay;
      if (this.dayFirst[d] === 0xffffffff) this.dayFirst[d] = i;
      this.dayLast[d] = i;
    }

    // Footprint of the columnar store + index structures:
    // day I32(4) campaign U16(2) country U8 device U8, impressions/spend/revenue
    // F64(8×3), clicks/conversions U32(4×2) = 40 B/row.
    this.approxBytes = rowCount * 40 + daySpan * 12 + generated.campaigns.length * 256;
    this.generatedAtMs = Date.now();
    this.generationMs = performance.now() - t0;
  }

  /** Stable cache key for a FilterState (categorical order-insensitive). */
  filterKey(f: FilterState): string {
    return [
      f.startDay,
      f.endDay,
      [...f.platforms].sort().join(","),
      [...f.countries].sort().join(","),
      [...f.devices].sort().join(","),
      [...f.campaigns].sort().join(","),
      f.minSpend ?? "",
      f.minRevenue ?? "",
    ].join("|");
  }

  /**
   * Compile a FilterState into a row-index array, memoized by filter key.
   * Without categorical filters the date window is a contiguous row slice.
   */
  compileFilter(filters: FilterState): Uint32Array {
    const key = this.filterKey(filters);
    const cached = this.filterCache.get(key);
    if (cached) {
      this.lastFilterCacheHit = true;
      return cached;
    }
    this.lastFilterCacheHit = false;

    const { startDay, endDay } = filters;
    const dStart = Math.max(0, startDay - this.dayMin);
    const dEnd = Math.min(this.dayMax - this.dayMin, endDay - this.dayMin);
    const hasPlatforms = filters.platforms.length > 0;
    const hasCountries = filters.countries.length > 0;
    const hasDevices = filters.devices.length > 0;
    const hasCampaigns = filters.campaigns.length > 0;
    const needScan = hasPlatforms || hasCountries || hasDevices || hasCampaigns ||
      filters.minSpend != null || filters.minRevenue != null;

    let result: Uint32Array;

    if (!needScan) {
      // Fast path: rows are day-ascending, so the window is one range.
      let first = -1;
      let last = -1;
      for (let d = dStart; d <= dEnd; d++) {
        if (this.dayFirst[d] !== 0xffffffff) {
          if (first === -1) first = this.dayFirst[d];
          last = this.dayLast[d];
        }
      }
      if (first === -1) {
        result = new Uint32Array(0);
      } else {
        const n = last - first + 1;
        result = new Uint32Array(n);
        for (let i = 0; i < n; i++) result[i] = first + i;
      }
    } else {
      const colDay = this.columns.day;
      const colCampaign = this.columns.campaign;
      const colCountry = this.columns.country;
      const colDevice = this.columns.device;
      const colSpend = this.columns.spend;
      const colRevenue = this.columns.revenue;

      const platformSet = new Array<boolean>(PLATFORMS.length).fill(false);
      for (const p of filters.platforms) {
        const idx = PLATFORM_IDX.get(p);
        if (idx != null) platformSet[idx] = true;
      }
      const countrySet = new Array<boolean>(COUNTRIES.length).fill(false);
      for (const c of filters.countries) {
        const idx = COUNTRY_IDX.get(c);
        if (idx != null) countrySet[idx] = true;
      }
      const deviceSet = new Array<boolean>(DEVICES.length).fill(false);
      for (const dv of filters.devices) {
        const idx = DEVICE_IDX.get(dv);
        if (idx != null) deviceSet[idx] = true;
      }
      const campaignIdx = new Set<number>();
      for (const id of filters.campaigns) {
        const idx = this.campaignIds.indexOf(id);
        if (idx >= 0) campaignIdx.add(idx);
      }

      const minSpend = filters.minSpend ?? -Infinity;
      const minRevenue = filters.minRevenue ?? -Infinity;

      // Pass 1 counts matches so the result is allocated exactly once.
      let count = 0;
      for (let i = 0; i < this.rowCount; i++) {
        const day = colDay[i];
        if (day < startDay || day > endDay) continue;
        if (hasPlatforms && !platformSet[PLATFORM_IDX.get(this.campaignPlatformOf(colCampaign[i]))!]) continue;
        if (hasCountries && !countrySet[colCountry[i]]) continue;
        if (hasDevices && !deviceSet[colDevice[i]]) continue;
        if (hasCampaigns && !campaignIdx.has(colCampaign[i])) continue;
        if (colSpend[i] < minSpend || colRevenue[i] < minRevenue) continue;
        count++;
      }
      result = new Uint32Array(count);
      let w = 0;
      for (let i = 0; i < this.rowCount; i++) {
        const day = colDay[i];
        if (day < startDay || day > endDay) continue;
        if (hasPlatforms && !platformSet[PLATFORM_IDX.get(this.campaignPlatformOf(colCampaign[i]))!]) continue;
        if (hasCountries && !countrySet[colCountry[i]]) continue;
        if (hasDevices && !deviceSet[colDevice[i]]) continue;
        if (hasCampaigns && !campaignIdx.has(colCampaign[i])) continue;
        if (colSpend[i] < minSpend || colRevenue[i] < minRevenue) continue;
        result[w++] = i;
      }
    }

    if (this.filterCache.size >= CACHE_CAP) {
      const oldest = this.filterCache.keys().next().value;
      if (oldest !== undefined) this.filterCache.delete(oldest);
    }
    this.filterCache.set(key, result);
    return result;
  }

  /** Platform index for a campaign slot (campaign → platform is static). */
  private campaignPlatformOf(campaignSlot: number): Platform {
    return this.campaigns[campaignSlot].platform;
  }

  clearFilterCache(): void {
    this.filterCache.clear();
  }

  // ── Aggregations ────────────────────────────────────────────────────────────

  totalsFor(indices: Uint32Array): Totals {
    const { day, impressions, clicks, conversions, spend, revenue } = this.columns;
    let sumImp = 0;
    let sumClk = 0;
    let sumCnv = 0;
    let sumSpd = 0;
    let sumRev = 0;
    const offset = this.dayMin;
    const seen = new Uint8Array(this.dayMax - offset + 1);
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      sumImp += impressions[i];
      sumClk += clicks[i];
      sumCnv += conversions[i];
      sumSpd += spend[i];
      sumRev += revenue[i];
      seen[day[i] - offset] = 1;
    }
    let activeDays = 0;
    for (let d = 0; d < seen.length; d++) activeDays += seen[d];
    return {
      impressions: sumImp,
      clicks: sumClk,
      conversions: sumCnv,
      spend: sumSpd,
      revenue: sumRev,
      rowCount: indices.length,
      activeDays,
    };
  }

  kpi(indices: Uint32Array): Kpi {
    const t = this.totalsFor(indices);
    return {
      ...t,
      avgCtr: t.impressions > 0 ? t.clicks / t.impressions : 0,
      avgConversionRate: t.clicks > 0 ? t.conversions / t.clicks : 0,
      cpc: t.clicks > 0 ? t.spend / t.clicks : 0,
      cpa: t.conversions > 0 ? t.spend / t.conversions : 0,
      roas: t.spend > 0 ? t.revenue / t.spend : 0,
    };
  }

  /** Current KPIs plus previous-equivalent-period comparison for % deltas. */
  kpiWithComparison(filters: FilterState): { current: Kpi; deltaPct: Record<string, number> } {
    const current = this.kpi(this.compileFilter(filters));
    const prev = previousPeriod(filters.startDay, filters.endDay);
    const previous = this.kpi(this.compileFilter({ ...filters, startDay: prev.startDay, endDay: prev.endDay }));
    const delta = (cur: number, before: number): number =>
      before > 0 ? ((cur - before) / before) * 100 : cur > 0 ? 100 : 0;
    return {
      current,
      deltaPct: {
        impressions: delta(current.impressions, previous.impressions),
        clicks: delta(current.clicks, previous.clicks),
        conversions: delta(current.conversions, previous.conversions),
        spend: delta(current.spend, previous.spend),
        revenue: delta(current.revenue, previous.revenue),
        ctr: delta(current.avgCtr, previous.avgCtr),
        conversionRate: delta(current.avgConversionRate, previous.avgConversionRate),
        roas: delta(current.roas, previous.roas),
      },
    };
  }

  timeseries(filters: FilterState, granularity: "day" | "week"): TimeSeriesPoint[] {
    const indices = this.compileFilter(filters);
    const { day, impressions, clicks, conversions, spend, revenue } = this.columns;
    const width = granularity === "week" ? 7 : 1;
    const numBuckets = Math.ceil(spanDays(filters.startDay, filters.endDay) / width);
    const sums = new Float64Array(numBuckets * 5);
    const counts = new Uint32Array(numBuckets);

    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const b = Math.min(numBuckets - 1, Math.floor((day[i] - filters.startDay) / width));
      const o = b * 5;
      sums[o] += impressions[i];
      sums[o + 1] += clicks[i];
      sums[o + 2] += conversions[i];
      sums[o + 3] += spend[i];
      sums[o + 4] += revenue[i];
      counts[b]++;
    }

    const points: TimeSeriesPoint[] = [];
    for (let b = 0; b < numBuckets; b++) {
      if (counts[b] === 0) continue;
      const imp = sums[b * 5];
      const clk = sums[b * 5 + 1];
      const spd = sums[b * 5 + 3];
      points.push({
        day: filters.startDay + b * width,
        impressions: sums[b * 5],
        clicks: clk,
        conversions: sums[b * 5 + 2],
        spend: spd,
        revenue: sums[b * 5 + 4],
        ctr: imp > 0 ? clk / imp : 0,
        roas: spd > 0 ? sums[b * 5 + 4] / spd : 0,
      });
    }
    return points;
  }

  breakdown(filters: FilterState, dimension: BreakdownDimension, limit?: number): GroupTotals[] {
    const indices = this.compileFilter(filters);
    const { campaign, country, device, impressions, clicks, conversions, spend, revenue } = this.columns;
    const numGroups =
      dimension === "platform" ? PLATFORMS.length :
      dimension === "country" ? COUNTRIES.length :
      dimension === "device" ? DEVICES.length :
      this.campaigns.length;
    const sums = new Float64Array(numGroups * 5);

    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const g =
        dimension === "platform"
          ? PLATFORM_IDX.get(this.campaigns[campaign[i]].platform) ?? 0
          : dimension === "country" ? country[i]
          : dimension === "device" ? device[i]
          : campaign[i];
      const o = g * 5;
      sums[o] += impressions[i];
      sums[o + 1] += clicks[i];
      sums[o + 2] += conversions[i];
      sums[o + 3] += spend[i];
      sums[o + 4] += revenue[i];
    }

    const groups: GroupTotals[] = [];
    for (let g = 0; g < numGroups; g++) {
      const imp = sums[g * 5];
      const clk = sums[g * 5 + 1];
      const cnv = sums[g * 5 + 2];
      const spd = sums[g * 5 + 3];
      const rev = sums[g * 5 + 4];
      if (imp === 0 && clk === 0 && cnv === 0 && spd === 0 && rev === 0) continue;
      groups.push({
        key: String(g),
        label:
          dimension === "platform" ? PLATFORMS[g] :
          dimension === "country" ? COUNTRIES[g] :
          dimension === "device" ? DEVICES[g] :
          this.campaignNames[g],
        platform: dimension === "platform" ? PLATFORMS[g] : undefined,
        country: dimension === "country" ? COUNTRIES[g] : undefined,
        device: dimension === "device" ? DEVICES[g] : undefined,
        campaignId: dimension === "campaign" ? this.campaignIds[g] : undefined,
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
      });
    }

    if (limit != null) {
      groups.sort((a, b) => b.revenue - a.revenue);
      return groups.slice(0, limit);
    }
    return groups;
  }

  campaignReport(campaignId: string, filters: FilterState): { totals: Kpi; series: TimeSeriesPoint[] } {
    const withCampaign: FilterState = { ...filters, campaigns: [campaignId] };
    return {
      totals: this.kpi(this.compileFilter(withCampaign)),
      series: this.timeseries(withCampaign, "day"),
    };
  }
}
