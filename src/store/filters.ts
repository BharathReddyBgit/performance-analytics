import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { FilterState } from "@/types/analytics";
import { filterStateFromPreset } from "@/utils/date";

/**
 * Global filter store. Lives outside React so charts, tables, and the header
 * all read the same filter state without prop drilling; components subscribe
 * with narrow selectors to avoid re-rendering on unrelated fields.
 */
export interface FilterStore extends FilterState {
  search: string;
  setPreset: (preset: FilterState["preset"]) => void;
  setCustomRange: (startDay: number, endDay: number) => void;
  toggleArrayFilter: <K extends "platforms" | "countries" | "devices" | "campaigns">(
    key: K,
    value: FilterState[K][number],
  ) => void;
  setMinSpend: (v: number | null) => void;
  setMinRevenue: (v: number | null) => void;
  setSearch: (v: string) => void;
  clearAll: () => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  ...filterStateFromPreset("30d"),
  search: "",
  setPreset: (preset) => set(filterStateFromPreset(preset)),
  setCustomRange: (startDay, endDay) =>
    set((s) => ({ ...s, preset: "custom", startDay, endDay })),
  toggleArrayFilter: (key, value) =>
    set((s) => {
      const current = s[key] as string[];
      const next = current.includes(value as string)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...s, [key]: next } as Pick<FilterStore, typeof key>;
    }),
  setMinSpend: (v) => set({ minSpend: v }),
  setMinRevenue: (v) => set({ minRevenue: v }),
  setSearch: (v) => set({ search: v }),
  clearAll: () => set({ ...filterStateFromPreset("30d"), search: "" }),
}));

/** Derived array of active filter chips for the filter bar UI. */
export interface ActiveFilterChip {
  id: string;
  label: string;
  clear: () => void;
}

/**
 * Stable FilterState selector: shallow-compared and excludes `search`, so
 * debounced typing never re-triggers chart/KPI queries that don't use it.
 */
const selectAnalyticsFilters = useShallow((s: FilterStore): FilterState => ({
  preset: s.preset,
  startDay: s.startDay,
  endDay: s.endDay,
  platforms: s.platforms,
  countries: s.countries,
  devices: s.devices,
  campaigns: s.campaigns,
  minSpend: s.minSpend,
  minRevenue: s.minRevenue,
}));

/** Subscribe to just the analytics filter slice with a stable identity. */
export function useAnalyticsFilters(): FilterState {
  return useFilterStore(selectAnalyticsFilters);
}
