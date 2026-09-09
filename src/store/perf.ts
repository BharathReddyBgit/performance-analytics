import { create } from "zustand";
import type { DatasetMeta } from "@/types/analytics";

/** Mutable, non-React telemetry written by the table/search components. */
export interface TableMeta {
  filteredRows: number;
  visibleRows: number;
  lastSearchMs: number;
  lastQueryMs: number;
  lastRenderMs: number;
  /** Bumped on each write so PerfMonitor can re-read cheaply. */
  version: number;
}

const defaultMeta: TableMeta = {
  filteredRows: 0,
  visibleRows: 0,
  lastSearchMs: 0,
  lastQueryMs: 0,
  lastRenderMs: 0,
  version: 0,
};

export const useTableMeta = create<{
  meta: TableMeta;
  setMeta: (patch: Partial<TableMeta>) => void;
}>((set) => ({
  meta: defaultMeta,
  setMeta: (patch) =>
    set((s) => ({ meta: { ...s.meta, ...patch, version: s.meta.version + 1 } })),
}));

export const useDatasetStore = create<{
  meta: DatasetMeta | null;
  setMeta: (meta: DatasetMeta) => void;
}>((set) => ({
  meta: null,
  setMeta: (meta) => set({ meta }),
}));
