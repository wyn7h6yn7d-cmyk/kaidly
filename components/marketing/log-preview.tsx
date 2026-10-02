import { getT } from "@/lib/i18n/server";

/**
 * A faithful static rendering of the installation log in the product's own visual
 * language (fictional example data from the dictionary). HTML, not a screenshot, so it
 * stays sharp, translatable and in step with the design tokens.
 */
export async function LogPreview() {
  const t = await getT();
  const p = t.landing.preview;
  const tabs = t.app.installations.tabs;
  return (
    <div role="img" aria-label={t.landing.excel.previewLabel} className="min-w-0 bg-k-paper text-k-ink">
      <div className="border-b border-k-line px-5 pb-0 pt-6 sm:px-8 sm:pt-8">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-k-muted">{p.site}</p>
        <p className="mt-1 font-display text-2xl font-extrabold [overflow-wrap:anywhere] sm:text-[28px]">{p.installation}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
          <span className="font-mono font-semibold text-k-green">{p.identifier}</span>
          <span className="text-k-muted">{p.type}</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 bg-k-green" />
            {p.status}
          </span>
        </p>
        <div className="mt-5 flex gap-6 overflow-hidden whitespace-nowrap text-[15px] font-semibold text-k-muted">
          <span className="pb-3">{tabs.overview}</span>
          <span className="border-b-2 border-k-green pb-3 text-k-ink">{tabs.log}</span>
          <span className="hidden pb-3 min-[420px]:inline">{tabs.schedule}</span>
          <span className="hidden pb-3 sm:inline">{tabs.deficiencies}</span>
          <span className="hidden pb-3 xl:inline">{tabs.documents}</span>
        </div>
      </div>
      <ol className="divide-y divide-k-line bg-k-surface">
        {p.rows.map((row) => (
          <li key={row.date} className="grid gap-x-8 gap-y-1 px-5 py-5 sm:grid-cols-[136px_minmax(0,1fr)] sm:px-8">
            <div className="text-[15px]">
              <span className="font-semibold tabular-nums">{row.date}</span>{" "}
              <span className="text-k-muted tabular-nums">{row.time}</span>
              <span className="block font-semibold text-k-green">{row.type}</span>
              {row.label && (
                <span className="block text-xs font-semibold uppercase tracking-wider text-k-muted">{row.label}</span>
              )}
            </div>
            <div className="min-w-0 text-[15px]">
              <p className="text-base">{row.text}</p>
              {row.result && (
                <p className="mt-1">
                  <span className="font-semibold">{p.resultLabel}:</span> {row.result}
                </p>
              )}
              <p className="mt-1 text-k-muted">
                {p.recordedBy}: {row.by}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
