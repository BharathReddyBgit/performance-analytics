import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { analyticsClient } from "@/lib/analytics/client";
import { AppHeader } from "./AppHeader";
import { SidebarBody } from "./AppSidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatasetReady } from "@/hooks/use-analytics";
import { ErrorBoundary } from "./ErrorBoundary";

function BootGate({ children }: { children: React.ReactNode }) {
  const { data: meta, isError, error, refetch } = useDatasetReady();

  if (isError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm font-semibold">Failed to initialize analytics engine</p>
        <p className="max-w-md text-xs text-muted-foreground">{error?.message}</p>
        <button
          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-busy="true" aria-label="Loading dataset">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Samples route-render latency: starts a timer on navigation and records the
 * elapsed time after the browser has painted the new route (double-rAF).
 */
function RenderProbe() {
  const { pathname } = useLocation();
  useEffect(() => {
    const start = performance.now();
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        analyticsClient.renderLatency.push(performance.now() - start);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [pathname]);
  return null;
}

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <RenderProbe />
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r bg-card/40 lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-60">
        <AppHeader onMenu={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] p-4 sm:p-6">
          <ErrorBoundary>
            <BootGate>
              <Suspense
                fallback={
                  <div className="space-y-6" aria-busy="true">
                    <Skeleton className="h-8 w-56" />
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                      ))}
                    </div>
                  </div>
                }
              >
                <Outlet />
              </Suspense>
            </BootGate>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
