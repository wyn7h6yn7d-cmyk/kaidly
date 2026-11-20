import { ExternalLink } from "lucide-react";
import { ConfirmForm } from "@/components/forms/confirm-form";
import { DueMark } from "@/components/schedule/due-mark";
import { clearNextAudit } from "@/lib/actions/audits";
import { getInstallationAudits } from "@/lib/data/audits";
import { getT } from "@/lib/i18n/server";
import { todayInTallinn } from "@/lib/time";
import { AuditForm, NextAuditForm } from "./audit-form";

/** "Korraline audit" on an installation: last audit, next deadline (countdown), history; forms for admins. */
export async function AuditPanel({ orgId, orgSlug, installationId, canManage }: { orgId: string; orgSlug: string; installationId: string; canManage: boolean }) {
  const t = await getT();
  const a = t.app.audits;
  const today = todayInTallinn();
  const { audits, next } = await getInstallationAudits(orgId, installationId);
  const [last, ...earlier] = audits;
  const link = (url: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-k-green underline underline-offset-4">
      {a.openDocument}
      <ExternalLink aria-hidden="true" className="size-4" />
    </a>
  );

  return (
    <section aria-labelledby="audit" className="mb-8 border border-k-line bg-k-surface p-4 sm:p-5" data-testid="audit-panel">
      <h2 id="audit" className="text-lg font-bold">{a.title}</h2>
      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-k-muted">{a.last}</h3>
          {last ? (
            <div className="mt-2">
              <p className="font-semibold">{t.fmt.date(last.auditedOn)} · {last.auditor}</p>
              <p className="mt-1 break-words">{last.result}</p>
              {last.documentUrl && link(last.documentUrl)}
              <p className="text-sm text-k-muted">{a.addedBy(last.createdByName)}</p>
            </div>
          ) : (
            <p className="mt-2 text-k-muted">{a.none}</p>
          )}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-k-muted">{a.next}</h3>
          {next?.nextDueOn ? (
            <div className="mt-2 flex flex-wrap items-center gap-3" data-testid="next-audit">
              <span className="font-semibold">{t.fmt.date(next.nextDueOn)}</span>
              <DueMark nextDueOn={next.nextDueOn} today={today} />
            </div>
          ) : (
            <p className="mt-2 text-k-muted">{a.noNext}</p>
          )}
          {canManage && (
            <div className="mt-4 flex flex-col gap-3">
              <NextAuditForm orgSlug={orgSlug} installationId={installationId} today={today} current={next?.nextDueOn ?? null} />
              {next && <ConfirmForm action={clearNextAudit} fields={{ orgSlug, installationId }} confirm={a.clearConfirm} label={a.clearNext} />}
            </div>
          )}
        </div>
      </div>

      {earlier.length > 0 && (
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold text-k-green">{a.history} ({earlier.length})</summary>
          <ul className="mt-2 divide-y divide-k-line border-y border-k-line">
            {earlier.map((x) => (
              <li key={x.id} className="py-2 text-sm">
                <span className="font-semibold">{t.fmt.date(x.auditedOn)} · {x.auditor}</span> — <span className="break-words">{x.result}</span>
                {x.documentUrl && <> · {link(x.documentUrl)}</>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {canManage && (
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold text-k-green">{a.add}</summary>
          <div className="mt-4">
            <AuditForm orgSlug={orgSlug} installationId={installationId} today={today} />
          </div>
        </details>
      )}
    </section>
  );
}
