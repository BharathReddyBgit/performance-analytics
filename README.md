# Performance-Critical Data Visualization Dashboard

**Pulse Analytics** — a production-quality ad-performance analytics dashboard engineered around one constraint: **the browser must stay at 60fps while exploring hundreds of thousands of records.**

It is a frontend R&D project: every architectural decision — a Web Worker data engine, a columnar in-memory store, a virtualized table, and a live performance monitor — exists to demonstrate scalable data handling in React.

---

## Overview

| | |
|---|---|
| **Frontend** | React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · shadcn/ui |
| **State** | Zustand (filters/telemetry) · TanStack Query (async data layer) |
| **Data engine** | Web Worker · columnar typed arrays (`Int32Array`, `Float64Array`, …) |
| **Charts** | Recharts |
| **Table** | TanStack Virtual |
| **Auth** | Convex Auth (email OTP + guest sessions) |
| **Theme** | Light/dark, Modern design system (quiet neutrals, refined blue accent) |

### Pages

| Route | Page | What it demonstrates |
|---|---|---|
| `/` | Landing | Product overview, entry into auth flow |
| `/auth` | Auth | Email OTP + guest sign-in |
| `/dashboard` | **Overview** | 8 KPI cards with period deltas, 6 interactive charts |
| `/dashboard/explorer` | **Data Explorer** | Virtualized table over the full dataset: sort, search, filters, pagination, CSV export |
| `/dashboard/campaigns` | Campaign Analytics | Aggregated campaign cards, campaign drill-down |
| `/dashboard/campaigns/:id` | Campaign Details | Per-campaign KPIs + daily revenue/spend/conversions trend |
| `/dashboard/monitor` | **Performance Monitor** | Live measured latencies (p50/p95), heap, dataset stats, cache counters |
| `/dashboard/settings` | Settings | Rebuild dataset (10k–200k rows), theme toggle |

---

## Problem Statement

Typical dashboards fetch 50k+ rows as JSON, map them to JS objects, and render every table row into the DOM. Three things kill them:

1. **Parse/allocate cost** — converting 50k JSON rows to objects freezes the main thread for hundreds of ms.
2. **DOM explosion** — 50k `<tr>` nodes make every scroll a layout event.
3. **Re-render storms** — one filter change re-runs aggregation across all components.

Pulse Analytics eliminates all three by design.

---

## Architecture

```
User
 ↓
React 19 + TypeScript (pages, charts, virtualized table)
 ↓
TanStack Query  ←─ query keys embed the exact filter snapshot
 ↓
analytics client (promise-correlated postMessage, latency ring buffers)
 ↓
Web Worker — AnalyticsEngine
 ├─ generateDataset()  deterministic seeded synthetic data
 ├─ AnalyticsStore     columnar typed arrays + day-run index + filter cache
 └─ query/sort/page    search → sort → paginate, CSV serialization
 ↓
Zustand (filter store, telemetry stores)
```

### Data flow

1. On boot, the main thread sends `{ type: "init", rowCount }`.
2. The worker generates the dataset **entirely inside the worker** and replies with compact metadata (row count, campaigns, byte footprint).
3. Every view then sends a *query* — filters + search + sort + page — and receives **only the data it needs**:
   - KPI cards → one aggregated `Kpi` object
   - Charts → 8–545 aggregated points
   - Table → one page of ≤250 row objects
   - CSV → 5,000-row text chunks

**No raw dataset ever crosses the worker boundary.** The main thread never holds more than what is on screen.

### The columnar store

Records are stored as parallel typed arrays, not objects:

```
day:          Int32Array    campaign:  Uint16Array
country:      Uint8Array    device:    Uint8Array
impressions:  Float64Array  clicks:    Uint32Array
conversions:  Uint32Array   spend:     Float64Array
revenue:      Float64Array
```

~40 bytes per record, cache-friendly, zero per-row object headers. At 200k rows that is ~8 MB versus ~80+ MB as JS objects — and the arrays are allocated once.

Rows are reordered **day-ascending** with an O(n) counting sort after generation, so a date-window filter becomes a contiguous slice instead of a full scan. The store also keeps an **LRU filter cache** (keyed by the full filter state) so re-sorting, re-paging, or toggling between previously seen filter states skips the scan entirely.

---

## Performance Optimizations

### 1. Why virtualization was used

`@tanstack/react-virtual` renders only the ~20 rows inside the viewport (+8 overscan). For 200k filtered rows the DOM contains **~28 `<tr>` nodes**, regardless of dataset size. Scroll stays a compositor-driven transform instead of a layout event. Without it, the table alone would create 200k rows × 16 cells = 3.2M DOM nodes — impossible on any device.

### 2. Why server-side-style pagination was used

The engine's query API mirrors a server contract (`page`, `pageSize`, `sortBy`, `sortDir`, filters) and returns `{ data, pagination }`. Only one page of row *objects* is materialized per response — the sort runs on an index array, not on row objects, so `page 2` reuses the memoized sorted view with zero additional aggregation. The same protocol would work unchanged against a REST backend.

### 3. How debouncing reduces API calls

Search input is debounced (`useDebounce`, 250 ms) before it enters the filter store, so typing "linkedin" produces **one** engine query instead of eight. Keystrokes still update the input instantly because the raw value lives in local component state; only the settled value reaches the data layer.

### 4. How memoization reduces unnecessary computation

- `React.memo` on every chart, KPI card, and table row render path.
- `useMemo` for chart data mapping and query objects (stable references → stable query keys).
- Engine-level memoization: filter→index compilation and the sorted view are cached inside the worker; identical requests are answered in microseconds.
- Zustand selectors with `useShallow` so unrelated filter fields don't re-render subscribed components.

### 5. How React Query caching works

Every query key embeds the exact filter snapshot:

```
["analytics", "table", { startDay, endDay, platforms, …, search, sortBy, page }]
```

- Identical filter state → cache hit, zero engine work.
- `staleTime: 5 min` — aggregates are immutable per filter snapshot in this workload.
- `placeholderData: prev` keeps the previous chart on screen while new filters compute, so the UI never flashes empty.
- "Refresh" is an explicit `invalidateQueries`, matching how a real server-backed cache would work.

### 6. How code splitting improves initial load

Every route is a `lazy()` chunk. Recharts, framer-motion, and radix primitives live in separate vendor chunks (`vite.config.ts` `manualChunks`), so the entry bundle stays small; the chart library only downloads when a chart page loads.

### 7. How large datasets are handled

- **Worker isolation** — generation, filtering, sorting, aggregation, and CSV serialization never block the main thread.
- **Columnar layout** — 40 B/row, SIMD-friendly tight loops.
- **Day-run index** — date filters slice instead of scanning.
- **LRU filter cache** — repeated interactions are O(1).
- **Search on campaign table** — matching campaigns are precomputed per query, then rows are tested with an O(1) flag lookup.
- **Chunked CSV export** — 5k rows per worker message with `setTimeout(0)` yields between chunks; the UI paints throughout a 200k-row export.

### 8. How unnecessary re-renders are avoided

- Global filter state lives **outside React** (Zustand) with narrow per-field selectors.
- Query results are structurally shared by TanStack Query; memoized children don't re-render when identical data re-arrives.
- The table's `useEffect` writes telemetry to an imperative store (not React state), so the Performance Monitor can poll without triggering render cascades.
- Route-level and chart-level error boundaries isolate failures.

---

## Dataset

Deterministic, seeded synthetic data (`mulberry32` PRNG) — same seed, same data, every session:

- **42 campaigns** across 5 platforms (Google Ads, Meta Ads, LinkedIn Ads, YouTube, TikTok), zipf-weighted so a few campaigns dominate revenue
- **545 days** of history ending yesterday
- Realistic platform economics: LinkedIn CPC ≈ 5× TikTok CPC, video CTRs lower than search
- Weekly seasonality (weekend dip), per-campaign country/device biases, Gaussian noise on CPC/CVR/ROAS

Size is configurable in **Settings → Dataset** (10k – 200k rows). The default is 60k. Generation is timed and reported on the Performance Monitor.

---

## API Documentation

The client-side engine intentionally mirrors a REST contract, so swapping in a real backend is a data-layer change only.

### Worker protocol (current implementation)

| Request | Payload | Response |
|---|---|---|
| `init` | `rowCount` | `ready` + dataset meta |
| `query` | filters, `search`, `sortBy`, `sortDir`, `page`, `pageSize` | `{ rows, pagination }` |
| `summary` | filters | `{ kpi, deltaPct }` (incl. previous-period comparison) |
| `timeseries` | filters, `granularity: "day" \| "week"` | `TimeSeriesPoint[]` |
| `breakdown` | filters, `dimension: platform\|country\|device\|campaign`, `limit?` | `GroupTotals[]` |
| `campaign` | `campaignId`, filters | `{ totals, series }` |
| `csv` | query, `offset`, `limit` | `{ text, totalRows, done }` (streamed chunks) |
| `clearCache` | — | `ack` |

Every response carries `processingMs` and `cacheHit` for the Performance Monitor.

### Equivalent REST shape (for reference)

```
GET /api/analytics?startDate&endDate&platform&country&device&campaign
                  &search&sortBy&sortOrder&page&pageSize
GET /api/analytics/summary
GET /api/analytics/timeseries?granularity=day|week
GET /api/analytics/platforms | /countries | /devices | /campaigns
GET /api/health
```

Response envelope:

```json
{
  "data": [],
  "pagination": { "page": 1, "pageSize": 100, "total": 50000, "totalPages": 500 }
}
```

All parameters are validated and clamped (`pageSize ≤ 1000`, page ≥ 1, unknown values rejected) — the same validation belongs on a server.

---

## Screenshots

> Explore the running app: landing → guest sign-in → Overview (KPIs + charts) → Data Explorer (search/sort/scroll 60k+ rows) → Performance Monitor (live p95s).

| Page | What to look at |
|---|---|
| Overview | 8 KPI cards with prev-period deltas; daily/weekly revenue toggle |
| Data Explorer | Row count vs. DOM rows rendered (~28 for any dataset size) |
| Performance Monitor | p50/p95 query & search latency, honest "unavailable" memory on Safari/Firefox |

---

## Local Setup

```bash
bun install        # or npm install / pnpm install
bun dev            # start dev server (platform-managed in Freebuff)
```

Open `http://localhost:5173`, click **Launch dashboard**, and sign in as guest.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_CONVEX_URL` | yes | Convex backend for auth |
| `VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL` | auto | Platform instrumentation |

No analytics/API secrets are needed: the data layer is local and deterministic. Do not hardcode URLs — always read from `import.meta.env`.

## Running Frontend

```bash
bun dev        # dev server
bun run build  # production build (tsc + vite build)
bun preview    # serve the build
```

## Running Backend

This build ships the data layer as an **in-browser Web Worker** (a deliberate architecture decision — see *Future Improvements*). The engine's API is the same contract a FastAPI backend would expose; to attach a real backend:

1. Implement the REST endpoints above in FastAPI, backed by Postgres/SQLite.
2. Replace the `requestWithId` call sites in `src/lib/analytics/client.ts` with `fetch` calls.
3. Keep `src/services/analyticsApi.ts` and every hook unchanged — only the transport changes.

---

## Performance Testing

The Performance Monitor page (`/dashboard/monitor`) records **only measured values** from this browser session. To reproduce:

1. Sign in → Performance Monitor.
2. Click around (switch presets, sort, search) to populate the ring buffers (200 samples).
3. Read p50/p95 for query/search/render, plus dataset bytes and cache counters.

### Reproducing at 10k / 50k / 100k / 200k records

1. Go to **Settings → Dataset**, enter the row count, click **Regenerate**.
2. Note the *Worker init* value on the monitor — dataset generation time.
3. Run the same interaction script at each size: change date range, sort by revenue, search "ads", page to 5, export CSV.
4. Compare the metrics below at each size.

### What to measure and how

| Metric | Where to measure | Method |
|---|---|---|
| Initial load | DevTools → Performance | Reload with cache disabled; read *LCP* and script compile time |
| API (engine) latency | Performance Monitor | p50/p95 query latency across 20+ interactions |
| Search latency | Performance Monitor | Type a query, read p50/p95 search latency |
| Table scrolling | DevTools → Performance, CPU 6× throttle | Scroll the explorer; check for long frames (>16ms) |
| Chart interaction | DevTools → Performance | Hover/toggle charts; record frame durations |
| Memory | Performance Monitor | Heap used/limit (Chrome; labeled *unavailable* elsewhere) |
| DOM size | DevTools console | `document.querySelectorAll('tr').length` while scrolling — stays ~30 |

No benchmark numbers are claimed in this README: run the procedure above on your hardware and record what you observe. The monitor's status band (Excellent / Good / Needs optimization) is derived from the measured p95s with the thresholds documented in `src/hooks/use-performance.ts`.

### Engine invariant smoke test

A headless check of the query engine's core invariants runs without a browser:

```bash
bun run smoke   # generates 60k rows and validates the engine invariants
```

It verifies: date-window filtering (row window ⊆ [startDay, endDay]), metric consistency (`ctr = clicks/impressions`, `roas = revenue/spend`), descending sort order, pagination stability across pages, search by name and campaign ID (including zero-result handling), timeseries/breakdown totals reconciling with KPI sums, CSV chunk coverage, and filter-cache hits on repeated queries.

---

## Deployment

Frontend (Vercel / Netlify / any static host):

```bash
bun run build   # outputs dist/
```

Set `VITE_CONVEX_URL` in the host's environment settings. The app is fully static — no server rendering, no runtime secrets in the client bundle.

---

## Future Improvements

- **Real backend**: swap the worker transport for FastAPI + Postgres with the same API contract (the code is structured for exactly this swap).
- **Server-side aggregation pushdown** for datasets beyond ~1M rows.
- **IndexedDB persistence** so the dataset survives reloads without regeneration.
- **Unit tests** for the engine (aggregation sums, filter correctness, CSV round-trip) via `vitest` — the engine is pure and worker-isolated, which makes it directly testable.
- **Shared RSSW/SSR data loading** if a server is introduced.
- **Accessibility audit** to WCAG AAA contrast on chart series.

## Author

Built as a Frontend R&D assignment demonstrating performance-critical React engineering.
