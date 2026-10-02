import Link from "next/link";
import { Bell } from "lucide-react";
import { notificationSummary } from "@/lib/data/notifications";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Bell with the unread count; the count is in the accessible name, not only the badge. */
export async function NotificationBell({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [t, { unread }] = await Promise.all([getT(), notificationSummary()]);
  return (
    <Link
      href="/teavitused"
      aria-label={t.notifications.bell(unread)}
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-sm",
        tone === "light" ? "focus-on-dark text-white/90 hover:bg-white/5" : "text-k-ink hover:bg-k-ink/5",
      )}
    >
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          data-testid="notification-count"
          className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-k-danger px-1 text-center text-xs font-bold leading-5 text-white"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

export function BellPlaceholder() {
  return <span className="inline-block size-11 shrink-0" />;
}
