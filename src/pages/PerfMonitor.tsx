import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { usePerfSnapshot, perfStatus } from "@/hooks/use-performance";
import { analyticsClient } from "@/lib/analytics/client";
import { formatBytes, formatMs } from "@/utils/format";
import { cn } from "@/lib/utils";
import { Database, Gauge, Layers, MemoryStick, Timer, Zap } from "lucide-react";

function StatCard({ title, value, sub, icon, unavailable }: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  unavailable?: boolean;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {icon}
            {title}
          </span>
          {unavailable && <Badge variant="outline" className="text-[10px]">n/a</Badge>}
        </div>
        <p className={cn("mt-2 font-mono text-xl font-semibold", unavailable && "text-muted-foreground")}>
          {value}
        </p>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Inner() {
  const s = usePerfSnapshot();
  const status = perfStatus(s);
  const queryClient = useQueryClient();

  const statusMeta = {
    "excellent": { label: "Excellent", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    "good": { label: "Good", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    "needs-optimization": { label: "Needs optimization", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
  }[status];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Performance Monitor</h2>
          <p className="text-xs text-muted-foreground">Live, measured in this browser session. No synthetic values.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusMeta.cls}`}>
            {statusMeta.label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              analyticsClient.queryLatency.clear();
              analyticsClient.searchLatency.clear();
              analyticsClient.renderLatency.clear();
              void queryClient.invalidateQueries({ queryKey: ["analytics"] });
            }}
          >
            Reset samples
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Dataset size" value={s.datasetRows ? s.datasetRows.toLocaleString() : "—"} sub={formatBytes(s.datasetBytes) + " columnar"} icon={<Database className="size-3" />} />
        <StatCard title="Filtered rows" value={s.filteredRows ? s.filteredRows.toLocaleString() : "—"} sub="matching current filters" icon={<Layers className="size-3" />} />
        <StatCard title="Visible rows" value={s.visibleRows ? String(s.visibleRows) : "—"} sub="rendered in DOM (virtualized)" icon={<Gauge className="size-3" />} />
        <StatCard
          title="Memory (heap)"
          value={s.heapUsedMb != null ? `${s.heapUsedMb.toFixed(0)} MB` : "unavailable"}
          sub={s.heapLimitMb != null ? `limit ~${s.heapLimitMb.toFixed(0)} MB` : "performance.memory not exposed"}
          icon={<MemoryStick className="size-3" />}
          unavailable={s.heapUsedMb == null}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Query latency" value={formatMs(s.lastQueryMs)} sub={`p50 ${formatMs(s.p50QueryMs)} · p95 ${formatMs(s.p95QueryMs)}`} icon={<Timer className="size-3" />} />
        <StatCard title="Search latency" value={formatMs(s.lastSearchMs)} sub={`p50 ${formatMs(s.p50SearchMs)} · p95 ${formatMs(s.p95SearchMs)}`} icon={<Zap className="size-3" />} />
        <StatCard title="Last render" value={formatMs(s.lastRenderMs)} sub={`p95 ${formatMs(s.p95RenderMs)}`} icon={<Gauge className="size-3" />} />
        <StatCard
          title="Worker init"
          value={formatMs(s.initMs)}
          sub="dataset generation"
          icon={<Timer className="size-3" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Notes on measurement</CardTitle>
          <CardDescription className="text-xs">
            All latencies are worker-side processing times (performance.now deltas) sampled into
            200-slot ring buffers. Heap figures use Chrome&apos;s non-standard performance.memory —
            on browsers without it, memory is labeled unavailable rather than estimated.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Cache: {s.cacheHits} hits / {s.cacheMisses} requests served through the React Query layer;
          repeated filter states are answered from cache without touching the engine.
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(Inner);
