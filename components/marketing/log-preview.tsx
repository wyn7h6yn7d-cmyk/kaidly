import { t } from "@/lib/i18n";

/**
 * A faithful, static rendering of the installation log in the product's own visual
 * language (fictional example data). Built in HTML rather than a screenshot so it stays
 * sharp and in sync with the design tokens.
 */
const ROWS = [
  { date: "12.03.2026", time: "09:40", type: "Mõõtmine", text: "Isolatsioonitakistuse mõõtmine väljuvatel liinidel.", result: "Kõik > 500 MΩ", by: "Kati Käitaja" },
  { date: "04.03.2026", time: "14:15", type: "Remont", text: "Lahtine klemm X3 pingutatud, kontrollitud termokaameraga.", label: "Puuduse lahendus", by: "Mati Meister" },
  { date: "21.02.2026", time: "08:05", type: "Kontroll", text: "Kilbi visuaalne kontroll, klemmide ülevaatus.", result: "Korras", label: "Käidukava", by: "Kati Käitaja" },
];

export function LogPreview() {
  return (
    <div role="img" aria-label={t.landing.excel.previewLabel} className="bg-k-paper text-k-ink shadow-[0_1px_0_hsl(var(--k-line))]">
      <div className="border-b border-k-line px-6 pb-4 pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-k-muted">Näidisküla logistikakeskus</p>
        <p className="mt-1 font-display text-2xl font-extrabold">Peajaotuskilp</p>
        <p className="mt-1 flex items-center gap-3 text-sm">
          <span className="font-mono font-semibold text-k-green">PJK-1</span>
          <span className="text-k-muted">Jaotuskilp</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 bg-k-green" />
            Kasutuses
          </span>
        </p>
        <div className="mt-4 flex gap-5 overflow-hidden whitespace-nowrap text-sm font-semibold text-k-muted">
          <span>Ülevaade</span>
          <span className="border-b-2 border-k-green pb-1 text-k-ink">Käidupäevik</span>
          <span>Käidukava</span>
          <span>Puudused</span>
          <span className="hidden sm:inline">Dokumendid</span>
        </div>
      </div>
      <ol className="divide-y divide-k-line bg-k-surface">
        {ROWS.map((row) => (
          <li key={row.date} className="grid gap-x-6 gap-y-1 px-6 py-4 sm:grid-cols-[120px_1fr]">
            <div className="text-sm">
              <span className="font-semibold tabular-nums">{row.date}</span>{" "}
              <span className="text-k-muted">{row.time}</span>
              <span className="block font-semibold text-k-green">{row.type}</span>
              {row.label && (
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-k-muted">{row.label}</span>
              )}
            </div>
            <div className="text-sm">
              <p className="text-[15px]">{row.text}</p>
              {row.result && (
                <p className="mt-0.5">
                  <span className="font-semibold">Tulemus:</span> {row.result}
                </p>
              )}
              <p className="mt-1 text-k-muted">Kirja pannud: {row.by}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
