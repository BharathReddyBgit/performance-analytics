import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * QueryClient is configured for an analytics workload:
 *  - 5-minute staleTime: filter snapshots are embedded in query keys, so a
 *    cached entry is always exactly the data for that filter state.
 *  - No refetchOnWindowFocus/refetchOnReconnect: the dataset is client-side
 *    and immutable per session, so cached aggregates never go stale in practice.
 *  - structuralSharing keeps object identity stable when identical rows are
 *    refetched, so memoized table rows don't re-render needlessly.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
