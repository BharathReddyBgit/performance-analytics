import { memo, useMemo, useState } from "react";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatPercent, formatRoas } from "@/utils/format";

function Inner() {
  const filters = useAnalyticsFilters();
  const [q, setQ] = useState("");
  const query = useDebounce(q, 200);
  const { data, isFetching } = useBreakdown(filters, "campaign");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.groups ?? [])
      .filter((g) => !needle || g.label.toLowerCase().includes(needle))
      .sort((a, b) => b.revenue - a.revenue);
  }, [data, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Campaign Analytics</h2>
          <p className="text-xs text-muted-foreground">Aggregated per campaign for the selected filters.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter campaigns…" className="h-9 w-60 pl-8" aria-label="Filter campaigns" />
        </div>
      </div>

      {isFetching && !data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((g) => (
            <Link key={g.key} to={`/campaigns/${g.campaignId}`} className="group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
              <Card className="h-full py-0 transition-shadow group-hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div>
                    <p className="truncate text-sm font-semibold">{g.label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{g.campaignId}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><p className="text-[10px] uppercase text-muted-foreground">Revenue</p><p className="font-mono font-semibold">{formatCurrency(g.revenue)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Spend</p><p className="font-mono font-semibold">{formatCurrency(g.spend)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">ROAS</p><p className="font-mono font-semibold">{formatRoas(g.roas)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">Clicks</p><p className="font-mono">{g.clicks.toLocaleString()}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">CVR</p><p className="font-mono">{formatPercent(g.conversionRate, 1)}</p></div>
                    <div><p className="text-[10px] uppercase text-muted-foreground">CTR</p><p className="font-mono">{formatPercent(g.ctr, 1)}</p></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 && data && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No campaigns match “{query}”.
        </div>
      )}
    </div>
  );
}

export default memo(Inner);
