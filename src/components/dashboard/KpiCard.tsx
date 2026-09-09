import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDelta } from "@/utils/format";

export interface KpiCardProps {
  label: string;
  value: string;
  /** % change vs previous period; null renders "—". */
  deltaPct: number | null;
  /** Higher is better (green up-arrow); false inverts colors. */
  goodWhenUp?: boolean;
  hint: string;
  loading?: boolean;
  icon: React.ReactNode;
}

/**
 * Pure presentational KPI card. Memoized: the Overview grid renders 8 of
 * these; memo keeps a tooltip-open card from re-rendering when siblings
 * receive new data.
 */
export const KpiCard = memo(function KpiCard({
  label,
  value,
  deltaPct,
  goodWhenUp = true,
  hint,
  loading,
  icon,
}: KpiCardProps) {
  const up = (deltaPct ?? 0) > 0;
  const positive = deltaPct == null ? null : goodWhenUp ? up : !up;

  return (
    <Card className="relative overflow-hidden py-0">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <CardContent className="flex cursor-help flex-col gap-2 p-4" aria-label={`${label}: ${value}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {icon}
                  {label}
                </span>
                {deltaPct != null && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold",
                      positive == null && "text-muted-foreground",
                      positive === true && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      positive === false && "bg-red-500/10 text-red-600 dark:text-red-400",
                    )}
                  >
                    {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {formatDelta(deltaPct)}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="h-7 w-24 animate-pulse rounded bg-muted" />
              ) : (
                <span className="font-mono text-[22px] font-semibold leading-none tracking-tight tabular-nums">
                  {value}
                </span>
              )}
            </CardContent>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-56 text-xs">
            {hint}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Card>
  );
});
