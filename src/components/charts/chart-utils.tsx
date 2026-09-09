import type { CSSProperties, ReactNode } from "react";

export const TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
};

export function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
      {label}
    </div>
  );
}

export function SrDescription({ children }: { children: ReactNode }) {
  return <p className="sr-only">{children}</p>;
}
