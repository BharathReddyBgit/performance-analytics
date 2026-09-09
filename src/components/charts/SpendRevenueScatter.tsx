import { memo, useMemo } from "react";
import {
  CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartEmpty, SrDescription, TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { useBreakdown } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCurrency, formatCurrencyFull, formatCompact } from "@/utils/format";
import { PLATFORM_COLORS } from "@/lib/constants";

/**
 * Spend vs Revenue scatter. One point per platform-day aggregate (60–90
 * points) rather than per-row (60k), keeping the SVG node count low while
 * remaining truthful — the totals still come from the full filtered set.
 */
function Inner() {
  const filters = useAnalyticsFilters();
  const platforms = useBreakdown(filters, "platform");

  const points = useMemo(
    () =>
      (platforms.data?.groups ?? []).map((g) => ({
        x: g.spend,
        y: g.revenue,
        z: g.clicks,
        label: g.label,
      })),
    [platforms.data],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spend vs Revenue</CardTitle>
        <CardDescription>Per platform, filtered window</CardDescription>
        <SrDescription>
          Scatter plot comparing advertising spend with revenue for each platform.
        </SrDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 280 }}>
          {points.length === 0 ? (
            <ChartEmpty label="No data for the selected filters" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  type="number" dataKey="x" name="Spend" tick={{ fontSize: 11 }}
                  tickLine={false} axisLine={false} tickFormatter={(v: number) => formatCurrency(v)}
                />
                <YAxis
                  type="number" dataKey="y" name="Revenue" tick={{ fontSize: 11 }}
                  tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatCurrency(v)}
                />
                <ZAxis type="number" dataKey="z" range={[60, 400]} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => {
                    if (name === "Spend" || name === "Revenue") return [formatCurrencyFull(Number(value)), String(name)];
                    return [formatCompact(Number(value)), String(name)];
                  }}
                />
                <Scatter data={points} isAnimationActive={false} shape={(props: { cx?: number; cy?: number; payload?: { label?: string } }) => {
                  const { cx = 0, cy = 0, payload } = props;
                  const color = PLATFORM_COLORS[(payload?.label ?? "") as keyof typeof PLATFORM_COLORS] ?? "var(--chart-1)";
                  return <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.65} />;
                }} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const SpendRevenueScatter = memo(Inner);
