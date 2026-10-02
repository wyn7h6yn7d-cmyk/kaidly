"use client";


import { cn } from "@/lib/utils";
import { LOG_ENTRY_TYPES, type LogEntryType } from "@/lib/validation/log";
import { useT } from "@/lib/i18n/client";

/**
 * Entry type as large radio chips (one tap on a phone). `selected` is the default; the
 * key remounts the group when it changes, so a form reset shows the submitted choice.
 */
export function EntryTypeField({ selected, invalid }: { selected?: string; invalid?: boolean }) {
  const t = useT();
  return (
    <fieldset key={selected ?? "none"} aria-invalid={invalid}>
      <legend className="mb-2 text-sm font-semibold">{t.app.log.fields.type}</legend>
      <div className="flex flex-wrap gap-2">
        {LOG_ENTRY_TYPES.map((type: LogEntryType) => (
          <label key={type} className="relative">
            <input
              type="radio"
              name="entryType"
              value={type}
              required
              defaultChecked={selected === type}
              className="peer sr-only"
            />
            <span
              className={cn(
                "flex h-11 cursor-pointer select-none items-center rounded-sm border border-k-grey/60 bg-k-surface px-4 text-[15px] font-semibold",
                "peer-checked:border-k-green peer-checked:bg-k-green peer-checked:text-white",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
              )}
            >
              {t.app.log.types[type]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
