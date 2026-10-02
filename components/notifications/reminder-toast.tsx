"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { CountdownMark } from "@/components/schedule/countdown-mark";
import type { CountdownLevel } from "@/lib/schedule";
import { useT } from "@/lib/i18n/client";

const SEEN_KEY = "kaidly_toasted_reminders";

function seen(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([id, ...seen().filter((v) => v !== id)].slice(0, 50)));
  } catch {
    // Storage blocked: the toast may show again; the reminder itself stays in Teavitused.
  }
}

/**
 * A short-lived pointer to a new reminder. It is never the reminder itself (that stays in
 * Teavitused) and each reminder is shown at most once per browser.
 */
export function ReminderToast({
  reminder,
}: {
  reminder: { id: string; title: string; where: string; countdown: string; level: CountdownLevel } | null;
}) {
  const t = useT();
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (!reminder || seen().includes(reminder.id)) return;
    // Remembered when actually shown (effects may run twice in development).
    const show = window.setTimeout(() => {
      remember(reminder.id);
      setVisible(reminder.id);
    }, 600);
    const hide = window.setTimeout(() => setVisible(null), 12_000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [reminder]);

  const open = reminder && visible === reminder.id;
  return (
    // The live region is always mounted so the announcement is reliable; it is empty
    // (silent) unless a new reminder appears.
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-end lg:inset-x-auto lg:bottom-6 lg:right-6"
    >
      {open && (
        <div
          data-testid="reminder-toast"
          className="pointer-events-auto w-full max-w-sm border border-k-line border-l-4 border-l-k-warn bg-k-surface p-4 shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-k-muted">{t.notifications.toastLabel}</p>
              <p className="mt-1 break-words font-semibold">{reminder.title}</p>
              <p className="break-words text-sm text-k-muted">{reminder.where}</p>
              <p className="mt-1">
                <CountdownMark level={reminder.level} text={reminder.countdown} />
              </p>
              <Link
                href={`/teavitused/${reminder.id}`}
                prefetch={false}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-k-green underline underline-offset-4"
              >
                {t.notifications.view} →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setVisible(null)}
              aria-label={t.notifications.close}
              className="-mr-2 -mt-2 inline-flex size-11 items-center justify-center rounded-sm text-k-muted hover:bg-k-ink/5"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
