import type { WorkerRequest, WorkerResponse } from "@/types/analytics";
import { AnalyticsEngine, serializeCsvRows } from "@/lib/analytics/engine";
import { datasetStartDay, datasetEndDay } from "@/utils/date";

let engine: AnalyticsEngine | null = null;

function post(msg: WorkerResponse): void {
  (self as unknown as Worker).postMessage(msg);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    switch (req.type) {
      case "init": {
        engine = new AnalyticsEngine(req.rowCount, datasetStartDay(), datasetEndDay());
        post({ type: "ready", meta: engine.meta });
        break;
      }
      case "query": {
        const t0 = performance.now();
        const r = engine!.query(req.query);
        post({
          type: "query", id: req.id,
          rows: r.rows, pagination: r.pagination,
          filteredRows: r.pagination.total,
          processingMs: performance.now() - t0, cacheHit: engine!.store.lastFilterCacheHit,
        });
        break;
      }
      case "summary": {
        const t0 = performance.now();
        const kpi = engine!.store.kpiWithComparison(req.filters);
        post({
          type: "summary", id: req.id,
          kpi: kpi.current, deltaPct: kpi.deltaPct,
          filteredRows: kpi.current.rowCount,
          processingMs: performance.now() - t0, cacheHit: engine!.store.lastFilterCacheHit,
        });
        break;
      }
      case "timeseries": {
        const t0 = performance.now();
        const points = engine!.store.timeseries(req.filters, req.granularity);
        post({ type: "timeseries", id: req.id, points, processingMs: performance.now() - t0, cacheHit: false });
        break;
      }
      case "breakdown": {
        const t0 = performance.now();
        const groups = engine!.store.breakdown(req.filters, req.dimension, req.limit);
        post({ type: "breakdown", id: req.id, groups, processingMs: performance.now() - t0, cacheHit: false });
        break;
      }
      case "campaign": {
        const t0 = performance.now();
        const r = engine!.store.campaignReport(req.campaignId, req.filters);
        post({ type: "campaign", id: req.id, totals: r.totals, series: r.series, processingMs: performance.now() - t0, cacheHit: false });
        break;
      }
      case "csv": {
        // Streams one chunk of the sorted/filtered view; the client loops
        // until done=true, so nothing large is ever held in one message.
        const t0 = performance.now();
        const rows = engine!.csvRows(req.query, req.offset, req.limit);
        const text = serializeCsvRows(rows);
        const total = engine!.viewLength(req.query);
        const done = req.offset + rows.length >= total;
        post({
          type: "csv", id: req.id, text, offset: req.offset,
          totalRows: total, done,
          processingMs: performance.now() - t0, cacheHit: false,
        });
        break;
      }
      case "clearCache": {
        engine!.store.clearFilterCache();
        post({ type: "ack", id: req.id, processingMs: 0, cacheHit: false });
        break;
      }
      default: {
        break;
      }
    }
  } catch (err) {
    post({
      type: "error",
      id: (req as { id?: number }).id ?? -1,
      message: err instanceof Error ? err.message : "Worker error",
    });
  }
};

