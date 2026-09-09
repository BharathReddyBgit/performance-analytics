import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, X } from "lucide-react";
import { useAnalyticsFilters, useFilterStore } from "@/store/filters";
import { PLATFORM_LIST, DEVICE_LIST } from "@/lib/constants";
import { COUNTRIES } from "@/types/analytics";
import { activeFilterCount } from "@/utils/date";
import { cn } from "@/lib/utils";
import type { Platform, Country, Device } from "@/types/analytics";

function MultiSelect({ label, options, selected, onToggle }: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 font-mono text-[10px]">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent">
                <Checkbox checked={checked} onCheckedChange={() => onToggle(opt)} />
                {opt}
              </label>
            );
          })}
        </div>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 w-full text-xs" onClick={() => selected.forEach(onToggle)}>
            Clear
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Inner() {
  const filters = useAnalyticsFilters();
  const toggle = useFilterStore((s) => s.toggleArrayFilter);
  const setMinSpend = useFilterStore((s) => s.setMinSpend);
  const setMinRevenue = useFilterStore((s) => s.setMinRevenue);
  const clearAll = useFilterStore((s) => s.clearAll);

  const togglePlatform = (v: string) => toggle("platforms", v as Platform);
  const toggleCountry = (v: string) => toggle("countries", v as Country);
  const toggleDevice = (v: string) => toggle("devices", v as Device);

  const chips: { id: string; label: string; clear: () => void }[] = [
    ...filters.platforms.map((p) => ({ id: `p-${p}`, label: p, clear: () => toggle("platforms", p) })),
    ...filters.countries.map((c) => ({ id: `c-${c}`, label: c, clear: () => toggle("countries", c) })),
    ...filters.devices.map((d) => ({ id: `d-${d}`, label: d, clear: () => toggle("devices", d) })),
  ];
  if (filters.minSpend != null) {
    chips.push({ id: "minSpend", label: `Spend ≥ $${filters.minSpend}`, clear: () => setMinSpend(null) });
  }
  if (filters.minRevenue != null) {
    chips.push({ id: "minRevenue", label: `Revenue ≥ $${filters.minRevenue}`, clear: () => setMinRevenue(null) });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Platform"
          options={PLATFORM_LIST}
          selected={filters.platforms}
          onToggle={togglePlatform}
        />
        <MultiSelect
          label="Country"
          options={COUNTRIES}
          selected={filters.countries}
          onToggle={toggleCountry}
        />
        <MultiSelect
          label="Device"
          options={DEVICE_LIST}
          selected={filters.devices}
          onToggle={toggleDevice}
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            placeholder="Min spend $"
            className="h-8 w-28 text-xs"
            value={filters.minSpend ?? ""}
            onChange={(e) => setMinSpend(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            aria-label="Minimum spend"
          />
          <Input
            type="number"
            min={0}
            placeholder="Min revenue $"
            className="h-8 w-32 text-xs"
            value={filters.minRevenue ?? ""}
            onChange={(e) => setMinRevenue(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            aria-label="Minimum revenue"
          />
        </div>

        {activeFilterCount(filters) > 0 && (
          <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip.id} variant="secondary" className="gap-1 py-1 pl-2.5">
              {chip.label}
              <button onClick={chip.clear} aria-label={`Remove ${chip.label} filter`} className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export const FilterPanel = memo(Inner);
