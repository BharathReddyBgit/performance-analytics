import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Menu, Moon, RefreshCw, Sun, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/store/filters";
import { DATE_PRESETS } from "@/lib/constants";
import { datasetEndDay, datasetStartDay, dayToISO, formatRangeLabel, isoToDay } from "@/utils/date";
import { toast } from "sonner";

export function AppHeader({ onMenu }: { onMenu: () => void }) {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const preset = useFilterStore((s) => s.preset);
  const startDay = useFilterStore((s) => s.startDay);
  const endDay = useFilterStore((s) => s.endDay);
  const setPreset = useFilterStore((s) => s.setPreset);
  const setCustomRange = useFilterStore((s) => s.setCustomRange);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const onPresetChange = (value: string) => {
    if (value === "custom") {
      const end = datasetEndDay();
      setCustomRange(end - 44, end);
    } else {
      setPreset(value as (typeof DATE_PRESETS)[number]["value"]);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="size-5" />
        </Button>

        <h1 className="hidden text-sm font-semibold tracking-tight sm:block">Performance Analytics</h1>

        <div className="ml-auto flex items-center gap-2">
          <Select value={preset} onValueChange={onPresetChange}>
            <SelectTrigger size="sm" className="w-[170px] font-mono text-xs" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
              <SelectItem value="custom">
                {preset === "custom" ? formatRangeLabel(startDay, endDay) : "Custom range…"}
              </SelectItem>
            </SelectContent>
          </Select>

          {preset === "custom" && (
            <div className="hidden items-center gap-1.5 md:flex">
              <input
                type="date"
                className="h-8 rounded-md border bg-transparent px-2 font-mono text-xs"
                value={dayToISO(startDay)}
                min={dayToISO(datasetStartDay())}
                max={dayToISO(endDay)}
                onChange={(e) => {
                  const d = isoToDay(e.target.value);
                  if (!Number.isNaN(d)) setCustomRange(Math.min(d, endDay), endDay);
                }}
                aria-label="Custom start date"
              />
              <input
                type="date"
                className="h-8 rounded-md border bg-transparent px-2 font-mono text-xs"
                value={dayToISO(endDay)}
                min={dayToISO(startDay)}
                max={dayToISO(datasetEndDay())}
                onChange={(e) => {
                  const d = isoToDay(e.target.value);
                  if (!Number.isNaN(d)) setCustomRange(startDay, Math.max(d, startDay));
                }}
                aria-label="Custom end date"
              />
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing} aria-label="Refresh data" className="gap-1.5">
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account menu">
                <User className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email ?? "Guest session"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><a href="/settings">Settings</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href="/monitor">Performance Monitor</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
