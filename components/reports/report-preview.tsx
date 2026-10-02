import type { T } from "@/lib/i18n";
import { PREVIEW_ROWS, type Report } from "@/lib/reports/types";

/** The report as data on screen: same sections as the PDF, first rows of each table. */
export function ReportPreview({ report, t }: { report: Report; t: T }) {
  return (
    <article aria-labelledby="report-title" className="border border-k-line bg-k-surface p-4 sm:p-6">
      <header className="border-b-2 border-k-green pb-3">
        <p className="text-sm font-semibold text-k-muted">{t.reports.preview}</p>
        <h2 id="report-title" className="text-2xl font-bold">
          {report.title}
        </h2>
        <p className="text-k-muted">{report.scope}</p>
      </header>
      {report.filters.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          {report.filters.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-k-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {report.sections.map((s) =>
        s.kind === "facts" ? (
          <section key={s.title} className="mt-6">
            <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_minmax(0,1fr)]">
              {s.rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-sm text-k-muted">{k}</dt>
                  <dd className="min-w-0 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <section key={s.title} className="mt-6 min-w-0">
            <h3 className="mb-1 text-lg font-bold">{s.title}</h3>
            <p role="status" className="mb-2 text-sm text-k-muted">
              {t.reports.matching(s.total)}
              {s.total > Math.min(s.rows.length, PREVIEW_ROWS) ? ` · ${t.reports.showingFirst(Math.min(s.rows.length, PREVIEW_ROWS))}` : ""}
            </p>
            {s.rows.length === 0 ? (
              <p className="text-k-muted">{s.empty}</p>
            ) : (
              <div role="region" aria-label={s.title} tabIndex={0} className="relative max-w-full overflow-x-auto border border-k-line">
                <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {s.columns.map((c) => (
                        <th key={c.key} scope="col" className="border-b border-k-line bg-k-paper-2 px-3 py-2 font-semibold">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                      <tr key={i}>
                        {s.columns.map((c) => (
                          <td key={c.key} className="whitespace-pre-line border-b border-k-line px-3 py-2 align-top">
                            {row[c.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ),
      )}
    </article>
  );
}
