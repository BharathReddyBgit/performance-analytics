import type {
  AnalyticsQuery,
  BreakdownDimension,
  DatasetMeta,
  FilterState,
  Kpi,
  GroupTotals,
  Pagination,
  TableRow,
  TimeSeriesPoint,
  WorkerRequest,
  WorkerResponse,
} from "@/types/analytics";
import { LATENCY_SAMPLES } from "@/lib/constants";
import { RingBuffer } from "@/lib/perf";

// ─────────────────────────────────────────────────────────────────────────────
// Single-worker client. All main-thread ↔ worker traffic flows through here:
// requests are promise-correlated by id, latencies are recorded into ring
// buffers for the Performance Monitor, and the worker is lazily spawned once.
// ─────────────────────────────────────────────────────────────────────────────

type Pending = {
  resolve: (value: WorkerResponse) => void;
  reject: (reason: Error) => void;
};

class AnalyticsClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;
  private readyPromise: Promise<DatasetMeta> | null = null;
  private rowCount = 60_000;

  // Latency tracking (consumed by the Performance Monitor).
  readonly queryLatency = new RingBuffer(LATENCY_SAMPLES);
  readonly searchLatency = new RingBuffer(LATENCY_SAMPLES);
  readonly renderLatency = new RingBuffer(LATENCY_SAMPLES);
  cacheHits = 0;
  cacheMisses = 0;
  lastQueryMs: number | null = null;
  lastSearchMs: number | null = null;

  private spawn(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      pending.resolve(msg);
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || "Worker failed");
      for (const [, p] of this.pending) p.reject(err);
      this.pending.clear();
    };
    this.worker = worker;
    return worker;
  }

  setRowCount(rows: number): void {
    this.rowCount = rows;
  }

  /** Boot the worker and wait for the dataset to be generated. */
  ready(): Promise<DatasetMeta> {
    if (this.readyPromise) return this.readyPromise;
    const worker = this.spawn();
    this.readyPromise = new Promise<DatasetMeta>((resolve, reject) => {
      const handler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === "ready") {
          worker.removeEventListener("message", handler);
          resolve(event.data.meta);
        } else if (event.data.type === "error") {
          worker.removeEventListener("message", handler);
          reject(new Error(event.data.message));
        }
      };
      worker.addEventListener("message", handler);
      const req: WorkerRequest = { type: "init", rowCount: this.rowCount };
      worker.postMessage(req);
    });
    return this.readyPromise;
  }

  /** Send a request and await its correlated response. */
  private request(req: Omit<WorkerRequest, "id"> & { id?: number }): Promise<WorkerResponse> {
    const worker = this.spawn();
    const id = this.nextId++;
    const payload = { ...req, id } as WorkerRequest;
    return new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(payload);
    });
  }

  /** Assert a response variant and throw a helpful error otherwise. */
  private expect<T extends WorkerResponse>(res: WorkerResponse, type: T["type"]): T {
    if (res.type === "error") throw new Error(res.message);
    if (res.type !== type) throw new Error(`Expected ${type}, got ${res.type}`);
    return res as T;
  }

  async query(query: AnalyticsQuery): Promise<{ rows: TableRow[]; pagination: Pagination; processingMs: number; isSearch: boolean }> {
    const isSearch = query.search.trim().length > 0;
    const res = await this.request({ type: "query", query });
    const r = this.expect<Extract<WorkerResponse, { type: "query" }>>(res, "query");
    if (isSearch) {
      this.searchLatency.push(r.processingMs);
      this.lastSearchMs = r.processingMs;
    } else {
      this.queryLatency.push(r.processingMs);
      this.lastQueryMs = r.processingMs;
    }
    this.cacheMisses++;
    return { rows: r.rows, pagination: r.pagination, processingMs: r.processingMs, isSearch };
  }

  async summary(filters: FilterState): Promise<{ kpi: Kpi; deltaPct: Record<string, number>; processingMs: number }> {
    const res = await this.request({ type: "summary", filters });
    const r = this.expect<Extract<WorkerResponse, { type: "summary" }>>(res, "summary");
    this.queryLatency.push(r.processingMs);
    this.lastQueryMs = r.processingMs;
    return { kpi: r.kpi, deltaPct: r.deltaPct, processingMs: r.processingMs };
  }

  async timeseries(filters: FilterState, granularity: "day" | "week"): Promise<{ points: TimeSeriesPoint[]; processingMs: number }> {
    const res = await this.request({ type: "timeseries", filters, granularity });
    const r = this.expect<Extract<WorkerResponse, { type: "timeseries" }>>(res, "timeseries");
    return { points: r.points, processingMs: r.processingMs };
  }

  async breakdown(filters: FilterState, dimension: BreakdownDimension, limit?: number): Promise<{ groups: GroupTotals[]; processingMs: number }> {
    const res = await this.request({ type: "breakdown", filters, dimension, limit });
    const r = this.expect<Extract<WorkerResponse, { type: "breakdown" }>>(res, "breakdown");
    return { groups: r.groups, processingMs: r.processingMs };
  }

  async campaignReport(campaignId: string, filters: FilterState): Promise<{ totals: Kpi; series: TimeSeriesPoint[]; processingMs: number }> {
    const res = await this.request({ type: "campaign", campaignId, filters });
    const r = this.expect<Extract<WorkerResponse, { type: "campaign" }>>(res, "campaign");
    return { totals: r.totals, series: r.series, processingMs: r.processingMs };
  }

  /** Stream one CSV chunk; callers loop until `done`. */
  async csvChunk(query: AnalyticsQuery, offset: number, limit: number): Promise<{ text: string; done: boolean; totalRows: number; processingMs: number }> {
    const res = await this.request({ type: "csv", query, offset, limit });
    const r = this.expect<Extract<WorkerResponse, { type: "csv" }>>(res, "csv");
    return { text: r.text, done: r.done, totalRows: r.totalRows, processingMs: r.processingMs };
  }

  async clearCache(): Promise<void> {
    await this.request({ type: "clearCache" });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
    this.pending.clear();
  }
}

export const analyticsClient = new AnalyticsClient();
