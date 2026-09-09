import { Badge } from "@/components/ui/badge";
import { logo, navItems } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDatasetReady } from "@/hooks/use-analytics";
import { formatCompact } from "@/utils/format";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router";

export function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { data: meta } = useDatasetReady();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <a href="/" className="flex items-center gap-2.5 px-2 pt-2" aria-label="Pulse Analytics home">
        <img src={logo} alt="" className="size-8 rounded-md" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">Pulse Analytics</span>
          <span className="text-[11px] text-muted-foreground">Performance R&D</span>
        </div>
        <Badge variant="secondary" className="ml-auto font-mono text-[10px]">v1</Badge>
      </a>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {navItems.map((item) => (
          <Button
            key={item.to}
            variant="ghost"
            className="w-full justify-start gap-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            onClick={() => {
              onNavigate?.();
              navigate(item.to);
            }}
          >
            <item.icon className="size-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      <div className="mt-auto space-y-3 px-1 pb-2">
        {meta && (
          <div className="rounded-lg border bg-card/50 p-3">
            <p className="text-[11px] font-medium text-muted-foreground">Dataset</p>
            <p className="mt-0.5 font-mono text-sm font-semibold">{formatCompact(meta.rowCount)} rows</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Generated in {meta.generationMs.toFixed(0)} ms · worker
            </p>
          </div>
        )}
        <Button variant="outline" className="w-full justify-start gap-3" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          Sign out {user?.name ? `(${user.name})` : ""}
        </Button>
      </div>
    </div>
  );
}
