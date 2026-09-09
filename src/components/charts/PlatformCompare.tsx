import { memo, useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmpty, SrDescription, TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCompact, formatCurrency } from "@/utils/format";
import { PLATFORM_COLORS } from "@/lib/constants";

function Inner() {
  const filters = useAnalyticsFilters();
  const { data, isFetching } = useBreakdown(filters, "platform");

  const rows = useMemo(
    () =>
      (data?.groups ?? []).map((g) => ({
        name: g.label.replace(" Ads", ""),
        Spend: g.spend,
        Revenue: g.revenue,
        Conversions: g.conversions,
        roas: g.roas,
      })),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform performance</CardTitle>
        <CardDescription>Spend, revenue and conversions by ad platform</CardDescription>
        <SrDescription>
          Grouped bar chart comparing spend and revenue with a conversions line, per platform.
        </SrDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 300 }}>
          {isFetching && !data ? (
            <div className="h-full animate-pulse rounded-lg bg-muted" />
          ) : rows.length === 0 ? (
            <ChartEmpty label="No data for the selected filters" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="money" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatCurrency(v)} />
                <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatCompact(v)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--accent)", opacity: 0.3 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="money" dataKey="Spend" fill="var(--chart-2)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar yAxisId="money" dataKey="Revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line yAxisId="conv" type="monotone" dataKey="Conversions" stroke="var(--chart-4)" strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const PlatformCompare = memo(Inner);
