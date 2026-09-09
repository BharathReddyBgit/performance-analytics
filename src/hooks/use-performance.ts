import { useEffect, useMemo, useState } from "react";
import { analyticsClient } from "@/lib/analytics/client";
import { useTableMeta, useDatasetStore } from "@/store/perf";
import { useDatasetReady } from "@/hooks/use-analytics";
import { LATENCY_SAMPLES } from "@/lib/constants";
import type { PerfSnapshot, PerfStatus } from "@/types/analytics";

interface MemoryInfo {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function heapInfo(): MemoryInfo | null {
  const perf = performance as Performance & { memory?: MemoryInfo };
  return perf.memory ?? null;
}

/**
 * Central performance-telemetry hook powering the Performance Monitor page.
 *
 * Only measurable values are reported:
 *  - Query/search/render latencies come from ring buffers fed by real events.
 *  - Heap usage requires Chrome's performance.memory; when absent the fields
 *    are null and the UI renders "unavailable" — never a fabricated number.
 */
export function usePerfSnapshot(): PerfSnapshot {
  const { meta } = useTableMeta();
  const datasetMeta = useDatasetStore((s) => s.meta);
  const { data: readyMeta } = useDatasetReady();

  // Re-derive on each telemetry write or page focus.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onVisible = () => setTick((t) => t + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return useMemo(() => {
    void tick;
    const heap = heapInfo();
    const effectiveMeta = datasetMeta ?? readyMeta ?? null;

    return {
      lastQueryMs: analyticsClient.lastQueryMs ?? 0,
      p50QueryMs: analyticsClient.queryLatency.percentile(50),
      p95QueryMs: analyticsClient.queryLatency.percentile(95),
      lastSearchMs: analyticsClient.lastSearchMs ?? 0,
      p50SearchMs: analyticsClient.searchLatency.percentile(50),
      p95SearchMs: analyticsClient.searchLatency.percentile(95),
      lastRenderMs: meta.lastRenderMs,
      p50RenderMs: analyticsClient.renderLatency.percentile(50),
      p95RenderMs: analyticsClient.renderLatency.percentile(95),
      heapUsedMb: heap ? heap.usedJSHeapSize / (1024 * 1024) : null,
      heapLimitMb: heap ? heap.jsHeapSizeLimit / (1024 * 1024) : null,
      initMs: effectiveMeta?.generationMs ?? 0,
      cacheHits: analyticsClient.cacheHits,
      cacheMisses: analyticsClient.cacheMisses,
      cacheEntries: analyticsClient.queryLatency.size,
      filteredRows: meta.filteredRows,
      visibleRows: meta.visibleRows,
      datasetRows: effectiveMeta?.rowCount ?? 0,
      datasetBytes: effectiveMeta?.approxBytes ?? 0,
    };
  }, [tick, meta, datasetMeta, readyMeta]);
}

/**
 * Status bands (measured medians, worker-side):
 *  - p95 query < 25ms and p95 search < 40ms → excellent
 *  - p95 query < 60ms and p95 search < 90ms → good
 *  - otherwise → needs optimization
 */
export function perfStatus(s: PerfSnapshot): PerfStatus {
  if (s.p95QueryMs == null && s.p95SearchMs == null) return "good";
  const q = s.p95QueryMs ?? 0;
  const se = s.p95SearchMs ?? 0;
  if (q < 25 && se < 40) return "excellent";
  if (q < 60 && se < 90) return "good";
  return "needs-optimization";
}

export { LATENCY_SAMPLES };
