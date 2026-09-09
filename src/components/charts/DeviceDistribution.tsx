import { memo, useMemo } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmpty, SrDescription, TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCurrency, formatPercent } from "@/utils/format";
import { DEVICE_COLORS } from "@/lib/constants";

function Inner() {
  const filters = useAnalyticsFilters();
  const { data, isFetching } = useBreakdown(filters, "device");

  const rows = useMemo(() => {
    const groups = data?.groups ?? [];
    const totalSpend = groups.reduce((acc, g) => acc + g.spend, 0);
    return groups.map((g) => ({
      name: g.label,
      value: g.spend,
      pct: totalSpend > 0 ? g.spend / totalSpend : 0,
      conversions: g.conversions,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device mix</CardTitle>
        <CardDescription>Share of spend by device</CardDescription>
        <SrDescription>Donut chart showing the share of advertising spend by device type.</SrDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 260 }}>
          {isFetching && !data ? (
            <div className="h-full animate-pulse rounded-lg bg-muted" />
          ) : rows.length === 0 ? (
            <ChartEmpty label="No data for the selected filters" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {rows.map((r) => (
                    <Cell key={r.name} fill={DEVICE_COLORS[r.name] ?? "var(--chart-3)"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const DeviceDistribution = memo(Inner);
