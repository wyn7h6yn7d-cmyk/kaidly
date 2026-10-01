import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Static rendering of the phone entry form (fictional data), in the product's own styles. */
export function PhonePreview({ className }: { className?: string }) {
  const types = ["Kontroll", "Hooldus", "Lülitamine", "Rike", "Remont", "Mõõtmine", "Muu"];
  return (
    <div
      role="img"
      aria-label={t.landing.phone.previewLabel}
      className={cn("w-[290px] shrink-0 rounded-[30px] border-[10px] border-[#202a26] bg-k-paper text-k-ink", className)}
    >
      <div className="flex h-11 items-center gap-2 border-b border-k-line px-4 text-sm font-semibold">
        <svg viewBox="0 0 32 32" className="size-5 text-k-green" aria-hidden="true">
          <path d="M20 2 L7 18 H15 L11 30 L25 13 H17 L22 2 Z" fill="currentColor" />
        </svg>
        Näidis Elektritööd OÜ
      </div>
      <div className="px-4 pb-5 pt-4">
        <p className="text-xs text-k-muted">‹ Näidisküla logistikakeskus</p>
        <p className="mt-1 font-display text-xl font-extrabold">Peajaotuskilp</p>
        <p className="mt-3 text-sm font-bold">Uus sissekanne</p>
        <p className="mt-3 text-xs font-semibold">Sissekande liik</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {types.map((type, i) => (
            <span
              key={type}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-xs font-semibold",
                i === 0 ? "border-k-green bg-k-green text-white" : "border-k-grey/60 bg-k-surface",
              )}
            >
              {type}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold">Kirjeldus</p>
        <div className="mt-1.5 h-20 rounded-sm border border-k-grey bg-k-surface p-2 text-xs leading-relaxed">
          Kilbi visuaalne kontroll, klemmid üle vaadatud. Märkusi ei ole.
          <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 bg-k-ink" />
        </div>
        <div className="mt-4 flex h-10 items-center justify-center rounded-sm bg-k-volt text-sm font-semibold">
          Salvesta sissekanne
        </div>
      </div>
    </div>
  );
}
