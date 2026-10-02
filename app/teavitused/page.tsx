import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PlainPage } from "@/components/app/plain-page";
import { LoadingBlock } from "@/components/app/states";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { NotificationList } from "@/components/notifications/notification-list";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { requireUser } from "@/lib/auth/session";
import { listNotifications, NOTIFICATION_PAGE_SIZE } from "@/lib/data/notifications";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.notifications.title };
}

type Search = Promise<{ vaade?: string; lk?: string }>;

async function Notifications({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const t = await getT();
  const copy = t.notifications;
  const { vaade, lk } = await searchParams;
  const page = Math.max(0, Number.parseInt(lk ?? "0", 10) || 0);
  // Unread first: the default view is unread when there is any; read history stays under "Kõik".
  const first = await listNotifications(true, 0);
  const all = vaade === "koik" || (vaade !== "lugemata" && first.unread === 0);
  const { rows, total, unread } = all || page > 0 ? await listNotifications(!all, page) : first;
  const tab = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold",
      active ? "border-k-green text-k-ink" : "border-transparent text-k-muted hover:text-k-ink",
    );
  const href = (p: number) => `/teavitused?vaade=${all ? "koik" : "lugemata"}${p ? `&lk=${p}` : ""}`;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-k-line">
        <nav aria-label={copy.title} className="flex">
          <Link href="/teavitused?vaade=lugemata" aria-current={!all ? "page" : undefined} className={tab(!all)}>
            {copy.tabs.unread}
            {unread > 0 && <span className="ml-1.5 text-k-muted">({unread})</span>}
          </Link>
          <Link href="/teavitused?vaade=koik" aria-current={all ? "page" : undefined} className={tab(all)}>
            {copy.tabs.all}
          </Link>
        </nav>
        {unread > 0 && (
          <div className="pb-2">
            <ConfirmForm action={markAllNotificationsRead} fields={{}} label={copy.markAllRead} />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-k-muted">{all ? copy.empty : copy.emptyUnread}</p>
      ) : (
        <NotificationList items={rows} />
      )}
      {total > NOTIFICATION_PAGE_SIZE && (
        <nav aria-label={copy.title} className="mt-4 flex gap-6">
          {page > 0 && (
            <Link href={href(page - 1)} className="inline-flex min-h-11 items-center font-semibold text-k-green underline">
              {copy.newer}
            </Link>
          )}
          {(page + 1) * NOTIFICATION_PAGE_SIZE < total && (
            <Link href={href(page + 1)} className="inline-flex min-h-11 items-center font-semibold text-k-green underline">
              {copy.older}
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: Search }) {
  const t = await getT();
  return (
    <PlainPage>
      <PageHeader title={t.notifications.title} description={t.notifications.intro} back={{ href: "/o", label: t.app.back }} />
      <Suspense fallback={<LoadingBlock lines={4} />}>
        <Notifications searchParams={searchParams} />
      </Suspense>
    </PlainPage>
  );
}
