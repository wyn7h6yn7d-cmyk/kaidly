import {
  Building2,
  CalendarCheck,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Settings,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/lib/i18n";

export type NavItem = {
  key: keyof typeof t.app.nav;
  label: string;
  icon: LucideIcon;
  /** Route segment under /o/[org]; "" is the dashboard. */
  segment: string;
  /** Shown in the mobile bottom bar; the rest go under "Rohkem". */
  mobile: boolean;
};

// Primary navigation (decision D20). URL segments are Estonian (ARCHITECTURE.md §3).
export const NAV_ITEMS: readonly NavItem[] = [
  { key: "overview", label: t.app.nav.overview, icon: LayoutDashboard, segment: "", mobile: true },
  { key: "sites", label: t.app.nav.sites, icon: Building2, segment: "objektid", mobile: false },
  { key: "log", label: t.app.nav.log, icon: NotebookPen, segment: "paevik", mobile: true },
  { key: "schedule", label: t.app.nav.schedule, icon: CalendarCheck, segment: "kaidukava", mobile: true },
  { key: "deficiencies", label: t.app.nav.deficiencies, icon: TriangleAlert, segment: "puudused", mobile: true },
  { key: "documents", label: t.app.nav.documents, icon: FileText, segment: "dokumendid", mobile: false },
  { key: "settings", label: t.app.nav.settings, icon: Settings, segment: "seaded", mobile: false },
];
