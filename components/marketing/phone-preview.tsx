import { LOG_ENTRY_TYPES } from "@/lib/validation/log";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

/** Static rendering of the phone entry form (fictional data), in the product's own styles. */
export async function PhonePreview({ className }: { className?: string }) {
  const t = await getT();
  const p = t.landing.preview;
  const log = t.app.log;
  return (
    <div
      role="img"
      aria-label={t.landing.phone.previewLabel}
      className={cn(
        "w-full max-w-[340px] rounded-[34px] border-[10px] border-[#202a26] bg-k-paper text-k-ink lg:max-w-[440px] lg:rounded-[42px] lg:border-[12px] xl:max-w-[470px]",
        className,
      )}
    >
      <div className="flex h-12 items-center gap-2 border-b border-k-line px-5 text-[15px] font-semibold lg:h-14 lg:px-6 lg:text-lg">
        <svg viewBox="0 0 32 32" className="size-5 shrink-0 text-k-green lg:size-6" aria-hidden="true">
          <path d="M20 2 L7 18 H15 L11 30 L25 13 H17 L22 2 Z" fill="currentColor" />
        </svg>
        <span className="truncate">{p.organisation}</span>
      </div>
      <div className="px-5 pb-6 pt-5 lg:px-6 lg:pb-8 lg:pt-6">
        <p className="truncate text-sm text-k-muted lg:text-base">‹ {p.site}</p>
        <p className="mt-1 font-display text-2xl font-extrabold [overflow-wrap:anywhere] lg:text-[32px]">{p.installation}</p>
        <p className="mt-4 font-bold lg:mt-5 lg:text-lg">{log.newTitle}</p>
        <p className="mt-4 text-sm font-semibold lg:mt-5 lg:text-base">{log.fields.type}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 lg:gap-2">
          {LOG_ENTRY_TYPES.map((type, i) => (
            <span
              key={type}
              className={cn(
                "rounded-sm border px-2.5 py-1.5 text-[13px] font-semibold lg:px-3 lg:py-2 lg:text-base",
                i === 0 ? "border-k-green bg-k-green text-white" : "border-k-grey/60 bg-k-surface",
              )}
            >
              {log.types[type]}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold lg:mt-5 lg:text-base">{log.fields.description}</p>
        <div className="mt-2 min-h-24 rounded-sm border border-k-grey bg-k-surface p-3 text-sm leading-relaxed lg:min-h-32 lg:p-4 lg:text-base">
          {p.entryDescription}
          <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-k-ink" />
        </div>
        <div className="mt-5 flex h-12 items-center justify-center rounded-sm bg-k-volt px-3 text-center text-[15px] font-semibold lg:mt-6 lg:h-14 lg:text-lg">
          {log.submit}
        </div>
      </div>
    </div>
  );
}
