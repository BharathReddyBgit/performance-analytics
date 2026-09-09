import { analyticsClient } from "@/lib/analytics/client";
import { serializeCsvRows, CSV_HEADER } from "@/lib/analytics/engine";
import { CSV_CHUNK_SIZE } from "@/lib/constants";
import type { AnalyticsQuery } from "@/types/analytics";

/**
 * Stream a filtered/sorted dataset to CSV without freezing the UI.
 *
 * The worker serializes one chunk per message; we yield to the event loop
 * between chunks (await + setTimeout 0) so paints and interactions stay
 * responsive even for 200k-row exports. Uses File System Access API when
 * available, otherwise falls back to a Blob download.
 */
export async function exportCsv(
  query: AnalyticsQuery,
  onProgress?: (rows: number, total: number) => void,
): Promise<number> {
  let offset = 0;
  let total = 0;
  const parts: string[] = [CSV_HEADER.join(",")];

  // First request also tells us the view length.
  for (;;) {
    const chunk = await analyticsClient.csvChunk(query, offset, CSV_CHUNK_SIZE);
    if (chunk.text) parts.push(chunk.text);
    offset += CSV_CHUNK_SIZE;
    total = chunk.totalRows;
    onProgress?.(Math.min(offset, total), total);
    if (chunk.done || offset >= chunk.totalRows) break;
    // Yield so the browser can paint — this is what keeps the UI alive.
    await new Promise((r) => setTimeout(r, 0));
  }

  const blob = new Blob([parts.join("\n")], { type: "text/csv;charset=utf-8" });
  parts.length = 0; // free the intermediate strings early

  const filename = `campaign-analytics-${new Date().toISOString().slice(0, 10)}.csv`;

  // Preferred: File System Access API (streaming save dialog, Chromium).
  const anyWindow = window as unknown as {
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
  };
  if (anyWindow.showSaveFilePicker) {
    try {
      const handle = await anyWindow.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return total;
    } catch {
      // User cancelled or API refused — fall through to the anchor download.
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
  return total;
}
