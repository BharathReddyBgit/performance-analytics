import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SrDescription } from "@/components/charts/chart-utils";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, formatRoas } from "@/utils/format";

type Metric = "revenue" | "spend" | "roas" | "ctr";

const METRIC_META: Record<Metric, { label: string; fmt: (v: number) => string }> = {
  revenue: { label: "Revenue", fmt: formatCurrency },
  spend: { label: "Spend", fmt: formatCurrency },
  roas: { label: "ROAS", fmt: formatRoas },
  ctr: { label: "CTR", fmt: (v) => formatPercent(v, 1) },
};

function Inner() {
  const [metric, setMetric] = useState<Metric>("revenue");
  const filters = useAnalyticsFilters();
  const { data, isFetching } = useBreakdown(filters, "country");

  const rows = useMemo(() => {
    const groups = [...(data?.groups ?? [])].sort((a, b) => b[metric] - a[metric]);
    const max = Math.max(1e-9, ...groups.map((g) => g[metric]));
    return groups.map((g) => ({ ...g, fraction: g[metric] / max }));
  }, [data, metric]);

  const meta = METRIC_META[metric];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Geographic performance</CardTitle>
            <CardDescription>Countries ranked by {meta.label.toLowerCase()}</CardDescription>
          </div>
          <div className="flex gap-1" role="tablist" aria-label="Country metric">
            {(Object.keys(METRIC_META) as Metric[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                  metric === m
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {METRIC_META[m].label}
              </button>
            ))}
          </div>
        </div>
        <SrDescription>
          Ranked list of countries with bars proportional to {meta.label}.
        </SrDescription>
      </CardHeader>
      <CardContent>
        {isFetching && !data ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
            No data for the selected filters
          </div>
        ) : (
          <ol className="space-y-2.5" aria-label="Countries ranked by metric">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                <span className="w-28 shrink-0 truncate text-xs font-medium">{r.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-300"
                    style={{ width: `${Math.max(2, r.fraction * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums">
                  {meta.fmt(r[metric])}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export const CountryRanking = memo(Inner);
