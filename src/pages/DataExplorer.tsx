import { memo } from "react";
import { FilterPanel } from "@/components/filters/FilterPanel";
import { DataExplorerTable } from "@/components/tables/DataExplorerTable";

function Inner() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Data Explorer</h2>
        <p className="text-xs text-muted-foreground">
          Virtualized table over the full dataset — filter, search, sort, and export.
        </p>
      </div>
      <FilterPanel />
      <DataExplorerTable />
    </div>
  );
}

export default memo(Inner);
