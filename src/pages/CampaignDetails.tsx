import { memo, useMemo } from "react";
import { Link, useParams } from "react-router";
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCampaignReport } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCompact, formatCurrency, formatCurrencyFull, formatInt, formatPercent, formatRoas, formatUsd2 } from "@/utils/format";
import { formatDay } from "@/utils/date";


function Inner() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const filters = useAnalyticsFilters();
  const { data, isFetching } = useCampaignReport(campaignId, filters);

  const series = useMemo(
    () => (data?.series ?? []).map((p) => ({ ...p, label: formatDay(p.day) })),
    [data],
  );

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild aria-label="Back to campaigns">
          <Link to="/campaigns"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{campaignId}</h2>
          <p className="text-xs text-muted-foreground">Campaign performance for the selected window.</p>
        </div>
      </div>

      {isFetching && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Spend", value: formatCurrency(t?.spend ?? 0) },
            { label: "Revenue", value: formatCurrency(t?.revenue ?? 0) },
            { label: "Clicks", value: formatCompact(t?.clicks ?? 0) },
            { label: "Conversions", value: formatCompact(t?.conversions ?? 0) },
            { label: "CTR", value: formatPercent(t?.avgCtr ?? 0) },
            { label: "CVR", value: formatPercent(t?.avgConversionRate ?? 0) },
            { label: "CPC", value: formatUsd2(t?.cpc ?? 0) },
            { label: "ROAS", value: formatRoas(t?.roas ?? 0) },
          ].map((s) => (
            <Card key={s.label} className="py-0">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-mono text-xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Daily trend</CardTitle>
          <CardDescription>Revenue, spend and conversions per day</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatCurrency(v)} />
                <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => formatCompact(v)} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) =>
                    name === "Conversions"
                      ? [formatInt(Number(v)), String(name)]
                      : [formatCurrencyFull(Number(v)), String(name)]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="conv" dataKey="conversions" name="Conversions" fill="var(--chart-4)" fillOpacity={0.5} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="money" type="monotone" dataKey="spend" name="Spend" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(Inner);
