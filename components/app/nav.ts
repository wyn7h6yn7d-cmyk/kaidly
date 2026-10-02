import {
  Building2,
  CalendarCheck,
  CircleHelp,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/lib/i18n";

export type NavItem = {
  /** Label: t.app.nav[key] in the active language. */
  key: keyof Messages["app"]["nav"];
  icon: LucideIcon;
  /** Route segment under /o/[org]; "" is the dashboard. */
  segment: string;
  /** Shown in the mobile bottom bar; the rest go under "Rohkem". */
  mobile: boolean;
};

// Primary navigation (decision D20). URL segments are Estonian (ARCHITECTURE.md §3).
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "overview", icon: LayoutDashboard, segment: "", mobile: true },
  { key: "sites", icon: Building2, segment: "objektid", mobile: false },
  { key: "log", icon: NotebookPen, segment: "paevik", mobile: true },
  { key: "schedule", icon: CalendarCheck, segment: "kaidukava", mobile: true },
  { key: "deficiencies", icon: TriangleAlert, segment: "puudused", mobile: true },
  { key: "documents", icon: FileText, segment: "dokumendid", mobile: false },
  { key: "settings", icon: Settings, segment: "seaded", mobile: false },
  { key: "help", icon: CircleHelp, segment: "abi", mobile: false },
];
