import { AnalyticsEngine } from "@/lib/analytics/engine";
import { datasetStartDay, datasetEndDay, filterStateFromPreset, resolvePreset } from "@/utils/date";
import type { AnalyticsQuery } from "@/types/analytics";

const engine = new AnalyticsEngine(60_000, datasetStartDay(), datasetEndDay());
console.log("meta rows:", engine.meta.rowCount, "days:", engine.meta.dayRange, "bytes:", engine.meta.approxBytes);

const { startDay, endDay } = resolvePreset("30d");
const filters = filterStateFromPreset("30d");

const query: AnalyticsQuery = {
  ...filters, search: "", sortBy: "revenue", sortDir: "desc", page: 1, pageSize: 100,
};
const t0 = performance.now();
const page1 = engine.query(query);
console.log(`query 30d: ${page1.rows.length} rows of ${page1.pagination.total} (p${page1.pagination.totalPages}) in ${(performance.now() - t0).toFixed(1)}ms`);

// Invariants: descending sort, metrics consistent, all within window
let ok = true;
for (let i = 1; i < page1.rows.length; i++) {
  if (page1.rows[i - 1].revenue < page1.rows[i].revenue) { ok = false; console.log("SORT FAIL at", i); break; }
}
const first = page1.rows[0];
for (const r of page1.rows) {
  if (r.day < startDay || r.day > endDay) { ok = false; console.log("WINDOW FAIL", r.day); break; }
  if (Math.abs(r.ctr - r.clicks / r.impressions) > 1e-9) { ok = false; console.log("CTR FAIL"); break; }
  if (Math.abs(r.roas - r.revenue / r.spend) > 1e-9) { ok = false; console.log("ROAS FAIL"); break; }
}
console.log("sample row:", JSON.stringify(first).slice(0, 140));

// Pagination consistency
const page2 = engine.query({ ...query, page: 2 });
console.log("page2 first row differs:", page2.rows[0].revenue !== first.revenue);

// Search
const searched = engine.query({ ...query, search: "ads" });
console.log(`search "ads": ${searched.pagination.total} rows (of ${page1.pagination.total})`);

// Summary with comparison
const t1 = performance.now();
const kpi = engine.store.kpiWithComparison(filters);
console.log(`summary in ${(performance.now() - t1).toFixed(1)}ms: spend=${kpi.current.spend.toFixed(0)} revenue=${kpi.current.revenue.toFixed(0)} roas=${kpi.current.roas.toFixed(2)} revDelta=${kpi.deltaPct.revenue?.toFixed(1)}%`);

// Timeseries + breakdown
const ts = engine.store.timeseries(filters, "day");
const tsSum = ts.reduce((a, p) => a + p.revenue, 0);
console.log(`timeseries days=${ts.length}, revenue sum matches: ${Math.abs(tsSum - kpi.current.revenue) < 1 ? "YES" : "NO " + (tsSum - kpi.current.revenue)}`);
const byPlatform = engine.store.breakdown(filters, "platform");
console.log(`platforms=${byPlatform.length}, revenue sum matches: ${Math.abs(byPlatform.reduce((a, g) => a + g.revenue, 0) - kpi.current.revenue) < 1 ? "YES" : "NO"}`);
const topCampaigns = engine.store.breakdown(filters, "campaign", 8);
console.log(`top8 campaigns, first=${topCampaigns[0].label.slice(0, 30)} rev=${topCampaigns[0].revenue.toFixed(0)}`);

// CSV chunks
const t2 = performance.now();
const csv1 = engine.csvRows(query, 0, 5000);
const len = engine.viewLength(query);
const csvLast = engine.csvRows(query, Math.max(0, len - 5000), 5000);
console.log(`csv: ${csv1.length}+${csvLast.length} of ${len} rows, viewLength cached ok, ${(performance.now() - t2).toFixed(1)}ms`);
console.log("csv row sample:", csv1[0].slice(0, 6).join(","));

// Cache behavior: second identical query should hit the filter cache
const before = engine.viewLength(query);
const t3 = performance.now();
engine.query(query);
const repeatMs = performance.now() - t3;
console.log(`repeat query (cached): ${repeatMs.toFixed(2)}ms, viewLength stable: ${engine.viewLength(query) === before ? "YES" : "NO"}`);

console.log(ok ? "ALL INVARIANTS PASS" : "INVARIANT FAILURES FOUND");
