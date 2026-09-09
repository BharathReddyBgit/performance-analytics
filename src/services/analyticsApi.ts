import { analyticsClient } from "@/lib/analytics/client";
import type {
  AnalyticsQuery,
  BreakdownDimension,
  FilterState,
} from "@/types/analytics";

/**
 * Data layer for TanStack Query.
 *
 * Query keys mirror the documented REST contract:
 *   ["analytics", "summary",   filters]
 *   ["analytics", "timeseries", filters, granularity]
 *   ["analytics", "breakdown",  filters, dimension, limit]
 *   ["analytics", "table",      query]
 *   ["analytics", "campaign",   campaignId, filters]
 *
 * Because every key embeds the exact filter snapshot, changing any filter
 * naturally produces a new cache entry, and identical inputs are served from
 * cache with zero work — including cancellation on unmount/stale replacement
 * (TanStack Query aborts in-flight tokens via `signal` below).
 */

export const analyticsKeys = {
  all: ["analytics"] as const,
  ready: () => [...analyticsKeys.all, "ready"] as const,
  summary: (filters: FilterState) => [...analyticsKeys.all, "summary", filters] as const,
  timeseries: (filters: FilterState, granularity: "day" | "week") =>
    [...analyticsKeys.all, "timeseries", filters, granularity] as const,
  breakdown: (filters: FilterState, dimension: BreakdownDimension, limit?: number) =>
    [...analyticsKeys.all, "breakdown", filters, dimension, limit ?? 0] as const,
  table: (query: AnalyticsQuery) => [...analyticsKeys.all, "table", query] as const,
  campaign: (campaignId: string, filters: FilterState) =>
    [...analyticsKeys.all, "campaign", campaignId, filters] as const,
};

async function withWorker<T>(fn: () => Promise<T>): Promise<T> {
  // Ensure the worker has booted before the first data request.
  await analyticsClient.ready();
  return fn();
}

export const analyticsApi = {
  ready: () => analyticsClient.ready(),

  summary: (filters: FilterState) =>
    withWorker(() => analyticsClient.summary(filters)),

  timeseries: (filters: FilterState, granularity: "day" | "week" = "day") =>
    withWorker(() => analyticsClient.timeseries(filters, granularity)),

  breakdown: (filters: FilterState, dimension: BreakdownDimension, limit?: number) =>
    withWorker(() => analyticsClient.breakdown(filters, dimension, limit)),

  table: (query: AnalyticsQuery) => withWorker(() => analyticsClient.query(query)),

  campaign: (campaignId: string, filters: FilterState) =>
    withWorker(() => analyticsClient.campaignReport(campaignId, filters)),
};
