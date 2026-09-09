import { formatCompact, formatCurrencyFull, formatInt, formatPercent, formatRoas, formatUsd2 } from "@/utils/format";
import { formatDayFull } from "@/utils/date";
import type { SortableColumn, TableRow } from "@/types/analytics";

export interface ColumnDef {
  key: SortableColumn;
  label: string;
  align?: "left" | "right";
  width: number;
  render: (row: TableRow) => string;
}

export const COLUMNS: ColumnDef[] = [
  { key: "day", label: "Date", width: 96, render: (r) => formatDayFull(r.day) },
  { key: "campaignName", label: "Campaign", width: 230, render: (r) => r.campaignName },
  { key: "platform", label: "Platform", width: 108, render: (r) => r.platform },
  { key: "country", label: "Country", width: 120, render: (r) => r.country },
  { key: "device", label: "Device", width: 84, render: (r) => r.device },
  { key: "impressions", label: "Impr.", width: 88, align: "right", render: (r) => formatInt(r.impressions) },
  { key: "clicks", label: "Clicks", width: 80, align: "right", render: (r) => formatInt(r.clicks) },
  { key: "conversions", label: "Conv.", width: 76, align: "right", render: (r) => formatInt(r.conversions) },
  { key: "spend", label: "Spend", width: 96, align: "right", render: (r) => formatUsd2(r.spend) },
  { key: "revenue", label: "Revenue", width: 106, align: "right", render: (r) => formatCurrencyFull(r.revenue) },
  { key: "ctr", label: "CTR", width: 74, align: "right", render: (r) => formatPercent(r.ctr, 2) },
  { key: "conversionRate", label: "CVR", width: 74, align: "right", render: (r) => formatPercent(r.conversionRate, 2) },
  { key: "cpc", label: "CPC", width: 78, align: "right", render: (r) => formatUsd2(r.cpc) },
  { key: "cpa", label: "CPA", width: 78, align: "right", render: (r) => formatUsd2(r.cpa) },
  { key: "roas", label: "ROAS", width: 78, align: "right", render: (r) => formatRoas(r.roas) },
];

export const TABLE_MIN_WIDTH = COLUMNS.reduce((a, c) => a + c.width, 0);
