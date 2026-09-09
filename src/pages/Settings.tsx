import { memo, useState } from "react";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDatasetReady } from "@/hooks/use-analytics";
import { analyticsClient } from "@/lib/analytics/client";
import { MIN_DATASET_ROWS, MAX_DATASET_ROWS } from "@/lib/constants";
import { formatBytes } from "@/utils/format";
import { Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

function Inner() {
  const { data: meta } = useDatasetReady();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState(60_000);
  const [busy, setBusy] = useState(false);

  const rebuild = async () => {
    const clamped = Math.max(MIN_DATASET_ROWS, Math.min(MAX_DATASET_ROWS, Math.round(rows)));
    setBusy(true);
    analyticsClient.setRowCount(clamped);
    analyticsClient.terminate(); // next ready() spawns a fresh worker
    await queryClient.invalidateQueries({ queryKey: ["analytics"] });
    setBusy(false);
    toast.success(`Rebuilding dataset with ${clamped.toLocaleString()} rows…`);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-xs text-muted-foreground">Runtime configuration for this session.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Dataset</CardTitle>
          <CardDescription className="text-xs">
            Regenerate the synthetic dataset. {meta ? `Current: ${meta.rowCount.toLocaleString()} rows (${formatBytes(meta.approxBytes)}).` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rows" className="text-xs">Rows ({MIN_DATASET_ROWS.toLocaleString()}–{MAX_DATASET_ROWS.toLocaleString()})</Label>
            <Input
              id="rows"
              type="number"
              min={MIN_DATASET_ROWS}
              max={MAX_DATASET_ROWS}
              step={10000}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="w-40 font-mono"
            />
          </div>
          <Button onClick={() => void rebuild()} disabled={busy}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Regenerate
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Larger datasets demonstrate virtualization and aggregation performance. Generation runs in the worker.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription className="text-xs">Theme preference persists in localStorage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dark" className="text-xs">Dark mode</Label>
            <div className="flex items-center gap-2">
              <Sun className="size-3.5 text-muted-foreground" />
              <Switch id="dark" checked={theme === "dark"} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
              <Moon className="size-3.5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">About</CardTitle>
        </CardHeader>
        <CardContent className="text-xs leading-6 text-muted-foreground">
          Pulse Analytics is a performance-focused R&D dashboard. The dataset is generated
          deterministically in a Web Worker and held as columnar typed arrays; every view requests
          aggregates over the wire, never raw rows. See the README for the full architecture notes.
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(Inner);
