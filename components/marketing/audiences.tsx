import { Building2, Factory, Sun, Wrench, type LucideIcon } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const ITEMS: { key: "operators" | "parks" | "buildings" | "housing"; icon: LucideIcon }[] = [
  { key: "operators", icon: Wrench },
  { key: "parks", icon: Sun },
  { key: "buildings", icon: Factory },
  { key: "housing", icon: Building2 },
];

/**
 * "Kellele KAIDLY sobib" (owner text, 2026-11-20): four audiences on one ruled sheet —
 * stacked on phones, 2 × 2 from tablet width. Same sheet language as the pricing table,
 * not floating cards (DESIGN.md).
 */
export async function Audiences() {
  const t = await getT();
  const a = t.landing.audiences;

  return (
    <section aria-labelledby="kellele-title" data-section="audiences" className="border-b border-k-line bg-k-paper">
      <div className="k-container k-section">
        <h2 id="kellele-title" className="font-display text-display-2 font-extrabold [overflow-wrap:break-word]">
          {a.title}
        </h2>
        <ul className="mt-10 grid grid-cols-1 border border-k-ink/70 sm:grid-cols-2 lg:mt-14" data-testid="audience-list">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <li
              key={key}
              data-audience={key}
              className={cn(
                "flex min-w-0 gap-5 p-6 lg:p-8",
                i > 0 && "border-t border-k-ink/20",
                i === 1 && "sm:border-l sm:border-t-0",
                i === 3 && "sm:border-l",
              )}
            >
              <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center border border-k-ink/70 bg-k-volt text-k-ink">
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-extrabold lg:text-2xl">{a.items[key].title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-k-ink/85 lg:text-lg">{a.items[key].body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
