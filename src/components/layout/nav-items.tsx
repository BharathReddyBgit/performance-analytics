import { BarChart3, Gauge, LayoutDashboard, Settings, Table2, Waypoints } from "lucide-react";
import logo from "@/assets/logo.svg";

export const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Waypoints },
  { to: "/dashboard/explorer", label: "Data Explorer", icon: Table2 },
  { to: "/dashboard/monitor", label: "Performance Monitor", icon: Gauge },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export { logo, BarChart3 };
