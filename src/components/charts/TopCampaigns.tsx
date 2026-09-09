import { memo, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartEmpty, SrDescription, TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCompact, formatCurrency, formatInt, formatPercent, formatRoas } from "@/utils/format";
import { BAR_METRICS, type BarMetric } from "@/lib/constants";
import { useNavigate } from "react-router";

const FORMATTERS: Record<BarMetric, (v: number) => string> = {
  revenue: formatCurrency,
  spend: formatCurrency,
  clicks: formatCompact,
  conversions: formatCompact,
  roas: formatRoas,
};

function Inner() {
  const [metric, setMetric] = useState<BarMetric>("revenue");
  const filters = useAnalyticsFilters();
  const navigate = useNavigate();
  const campaigns = useBreakdown(filters, "campaign", 8);
  const fmt = FORMATTERS[metric];

  const data = useMemo(
    () =>
      (campaigns.data?.groups ?? [])
        .slice()
        .sort((a, b) => b[metric] - a[metric])
        .map((g) => ({ name: g.label, value: g[metric], id: g.campaignId })),
    [campaigns.data, metric],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Top campaigns</CardTitle>
            <CardDescription>Click a bar to open the campaign</CardDescription>
          </div>
          <div className="flex gap-1" role="tablist" aria-label="Bar metric">
            {BAR_METRICS.map((m) => (
              <button
                key={m.value}
                role="tab"
                aria-selected={metric === m.value}
                onClick={() => setMetric(m.value)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  metric === m.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <SrDescription>
          Horizontal bar chart ranking the top campaigns by {metric}.
        </SrDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          {campaigns.isFetching && !campaigns.data ? (
            <Skeleton className="h-full w-full" />
          ) : data.length === 0 ? (
            <ChartEmpty label="No campaigns match the filters" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={fmt} />
                <YAxis
                  type="category" dataKey="name" width={150}
                  tick={{ fontSize: 10.5 }} tickLine={false} axisLine={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                  formatter={(v: number) => [fmt(Number(v)), BAR_METRICS.find((m) => m.value === metric)?.label ?? ""]}
                />
                <Bar
                  dataKey="value"
                  fill="var(--chart-1)"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  onClick={(entry: { payload?: { id?: string } }) => {
                    const id = entry?.payload?.id;
                    if (id) navigate(`/campaigns/${id}`);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const TopCampaigns = memo(Inner);
