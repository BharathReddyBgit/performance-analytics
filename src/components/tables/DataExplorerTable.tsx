import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Download, Loader2, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTablePage, buildAnalyticsQuery } from "@/hooks/use-analytics";
import { useAnalyticsFilters, useFilterStore } from "@/store/filters";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useDebounce } from "@/hooks/use-debounce";
import { useTableMeta } from "@/store/perf";
import { exportCsv } from "@/lib/csv-export";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCompact, formatInt } from "@/utils/format";
import { COLUMNS, TABLE_MIN_WIDTH, type ColumnDef } from "@/components/tables/columns";
import type { AnalyticsQuery, SortableColumn } from "@/types/analytics";

function HeaderCell({ col, sortKey, sortDir, onSort }: {
  col: ColumnDef;
  sortKey: SortableColumn;
  sortDir: "asc" | "desc";
  onSort: (k: SortableColumn) => void;
}) {
  const active = sortKey === col.key;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" style={{ width: col.width, minWidth: col.width }} className="px-2 py-2 text-left align-bottom">
      <button
        onClick={() => onSort(col.key)}
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide",
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          col.align === "right" && "w-full justify-end",
        )}
        aria-label={`Sort by ${col.label}`}
      >
        {col.label}
        <Icon className="size-3" />
      </button>
    </th>
  );
}

function Inner() {
  const filters = useAnalyticsFilters();
  const search = useFilterStore((s) => s.search);
  const setSearch = useFilterStore((s) => s.setSearch);
  const [searchInput, setSearchInput] = useState(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState<SortableColumn>("revenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebounce(searchInput, SEARCH_DEBOUNCE_MS);
  const setMeta = useTableMeta((s) => s.setMeta);

  useEffect(() => {
    if (debouncedSearch !== search) setSearch(debouncedSearch);
  }, [debouncedSearch, search, setSearch]);

  const query: AnalyticsQuery = useMemo(
    () => buildAnalyticsQuery(filters, debouncedSearch, { sortBy, sortDir, page, pageSize }),
    [filters, debouncedSearch, sortBy, sortDir, page, pageSize],
  );

  const { data, isFetching, isError, error, refetch } = useTablePage(query);
  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  const parentRef = useRef<HTMLDivElement>(null);
  const rowHeight = 40;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const padTop = virtualItems.length ? virtualItems[0].start : 0;
  const padBottom = virtualItems.length
    ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  useEffect(() => {
    if (data) {
      setMeta({
        filteredRows: data.pagination.total,
        visibleRows: rows.length,
        lastQueryMs: data.processingMs,
      });
    }
  }, [data, rows.length, setMeta]);

  useEffect(() => {
    setPage(1);
  }, [filters, debouncedSearch, pageSize, sortBy, sortDir]);

  const onSort = (key: SortableColumn) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  };

  const handleExport = async () => {
    setExporting(true);
    const t0 = performance.now();
    try {
      const total = await exportCsv(query);
      toast.success(`Exported ${formatInt(total)} rows in ${(performance.now() - t0).toFixed(0)} ms`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-semibold">Failed to load records</p>
        <p className="mt-1 text-xs text-muted-foreground">{error?.message}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
          Retry
        </Button>
      </Card>
    );
  }

  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(total, page * pageSize);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search campaigns…"
            className="h-9 w-64 pl-8"
            aria-label="Search campaigns by name or ID"
          />
          {isFetching && <Loader2 className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />}
        </div>

        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger size="sm" className="w-[110px]" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">
            {formatCompact(total)} rows
          </span>
          <Button variant="outline" size="sm" onClick={() => void handleExport()} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <div ref={parentRef} className="max-h-[62vh] overflow-auto" role="region" aria-label="Campaign records">
          <div style={{ minWidth: TABLE_MIN_WIDTH }}>
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                <tr>
                  {COLUMNS.map((c) => (
                    <HeaderCell key={c.key} col={c} sortKey={sortBy} sortDir={sortDir} onSort={onSort} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {virtualItems.length > 0 && (
                  <tr aria-hidden="true"><td colSpan={COLUMNS.length} style={{ height: padTop, padding: 0, border: 0 }} /></tr>
                )}
                {virtualItems.map((vi) => {
                  const row = rows[vi.index];
                  return (
                    <tr key={vi.key} className="border-b border-border/50 hover:bg-accent/40">
                      {COLUMNS.map((c) => (
                        <td key={c.key} className={cn("px-2 py-0 whitespace-nowrap", c.align === "right" && "text-right font-mono tabular-nums")}>
                          {row ? c.render(row) : ""}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {virtualItems.length > 0 && (
                  <tr aria-hidden="true"><td colSpan={COLUMNS.length} style={{ height: padBottom, padding: 0, border: 0 }} /></tr>
                )}
              </tbody>
            </table>
            {rows.length === 0 && !isFetching && (
              <div className="flex flex-col items-center justify-center gap-1 py-16 text-center">
                <p className="text-sm font-medium">No records match your filters</p>
                <p className="text-xs text-muted-foreground">Try widening the date range or clearing filters.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-mono">{formatInt(rangeStart)}</span>–
          <span className="font-mono">{formatInt(rangeEnd)}</span> of{" "}
          <span className="font-mono">{formatInt(total)}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage(1)} disabled={page === 1} aria-label="First page"><ChevronsLeft className="size-4" /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
          <span className="px-2 font-mono text-xs">{page} / {totalPages}</span>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Next page"><ChevronRight className="size-4" /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setPage(totalPages)} disabled={page >= totalPages} aria-label="Last page"><ChevronsRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}

export const DataExplorerTable = memo(Inner);
