import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { analyticsApi, analyticsKeys } from "@/services/analyticsApi";
import { useDatasetStore } from "@/store/perf";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type {
  AnalyticsQuery,
  BreakdownDimension,
  FilterState,
  TimeSeriesPoint,
  GroupTotals,
  Kpi,
} from "@/types/analytics";

/**
 * Thin React Query wrappers over the analytics worker API.
 * Every hook embeds its exact filter snapshot in the query key, so identical
 * inputs are served from cache, and switching filters keeps previous data
 * visible (placeholderData keeps charts stable while new data loads).
 */

/** Subscribe to dataset readiness. Returns meta once the worker has generated the dataset. */
export function useDatasetReady() {
  const q = useQuery({
    queryKey: analyticsKeys.ready(),
    queryFn: () => analyticsApi.ready(),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Mirror into the imperative store for non-React consumers (perf monitor).
  useEffect(() => {
    if (q.data) useDatasetStore.getState().setMeta(q.data);
  }, [q.data]);

  return q;
}

/** True once the dataset meta has been received. */
export function useDatasetReadyFlag(): boolean {
  const q = useDatasetReady();
  return q.isSuccess;
}

export function useSummary(filters: FilterState) {
  return useQuery({
    queryKey: analyticsKeys.summary(filters),
    queryFn: () => analyticsApi.summary(filters),
    placeholderData: (prev) => prev,
  });
}

export function useTimeseries(filters: FilterState, granularity: "day" | "week" = "day") {
  return useQuery({
    queryKey: analyticsKeys.timeseries(filters, granularity),
    queryFn: () => analyticsApi.timeseries(filters, granularity),
    placeholderData: (prev) => prev,
  });
}

export function useBreakdown(filters: FilterState, dimension: BreakdownDimension, limit?: number) {
  return useQuery({
    queryKey: analyticsKeys.breakdown(filters, dimension, limit),
    queryFn: () => analyticsApi.breakdown(filters, dimension, limit),
    placeholderData: (prev) => prev,
  });
}

export function useTablePage(query: AnalyticsQuery) {
  return useQuery({
    queryKey: analyticsKeys.table(query),
    queryFn: () => analyticsApi.table(query),
    placeholderData: (prev) => prev,
  });
}

export function useCampaignReport(campaignId: string | undefined, filters: FilterState) {
  return useQuery({
    queryKey: analyticsKeys.campaign(campaignId ?? "", filters),
    queryFn: () => analyticsApi.campaign(campaignId!, filters),
    enabled: !!campaignId,
    placeholderData: (prev) => prev,
  });
}

/** All campaign metadata (ids, names, platforms) for pickers. */
export function useCampaignList() {
  const { data } = useDatasetReady();
  return data?.campaigns ?? [];
}

/**
 * Build an AnalyticsQuery from a filter snapshot + local table controls.
 * Pure function (not a hook): callers select store fields individually with
 * narrow zustand selectors, then assemble the query in a useMemo.
 */
export function buildAnalyticsQuery(
  filters: FilterState,
  search: string,
  overrides: Partial<AnalyticsQuery> = {},
): AnalyticsQuery {
  return {
    preset: filters.preset,
    startDay: filters.startDay,
    endDay: filters.endDay,
    platforms: filters.platforms,
    countries: filters.countries,
    devices: filters.devices,
    campaigns: filters.campaigns,
    minSpend: filters.minSpend,
    minRevenue: filters.minRevenue,
    search,
    sortBy: "revenue",
    sortDir: "desc",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}
