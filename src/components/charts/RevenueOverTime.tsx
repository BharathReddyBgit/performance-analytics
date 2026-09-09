import { memo, useMemo } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartEmpty, SrDescription, TOOLTIP_STYLE } from "@/components/charts/chart-utils";
import { useTimeseries } from "@/hooks/use-analytics";
import { useAnalyticsFilters } from "@/store/filters";
import { formatCurrency, formatInt } from "@/utils/format";
import { formatDay } from "@/utils/date";

function Inner({ granularity }: { granularity: "day" | "week" }) {
  const filters = useAnalyticsFilters();
  const { data, isFetching } = useTimeseries(filters, granularity);

  const chartData = useMemo(
    () => (data?.points ?? []).map((p) => ({ ...p, label: formatDay(p.day) })),
    [data],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Revenue over time</CardTitle>
            <CardDescription>
              {granularity === "day" ? "Daily" : "Weekly"} totals for the selected window
            </CardDescription>
          </div>
          {isFetching && <Skeleton className="h-4 w-20" />}
        </div>
        <SrDescription>
          Line chart showing revenue and spend for each {granularity} in the selected date range.
        </SrDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: 280 }}>
          {chartData.length === 0 ? (
            <ChartEmpty label="No data in this range" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v: number) => formatCurrency(v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => [formatInt(Number(value)), String(name)]}
                />
                <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
                <Line type="monotone" dataKey="spend" stroke="var(--chart-2)" strokeWidth={2} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const RevenueOverTime = memo(Inner);
