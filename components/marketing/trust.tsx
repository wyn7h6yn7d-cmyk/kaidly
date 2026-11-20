import { aboutVisible, COMPANY } from "@/lib/company";
import { getT } from "@/lib/i18n/server";

/** "Meist" — switched by COMPANY.showAbout; the owner's text names no person. */
export async function About() {
  if (!aboutVisible(COMPANY)) return null;
  const t = await getT();
  return (
    <section aria-labelledby="meist-title" data-section="about" className="border-b border-k-line bg-k-paper">
      <div className="k-container k-section grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <h2 id="meist-title" className="font-display text-display-2 font-extrabold lg:col-span-5">
          {t.landing.about.title}
        </h2>
        <p className="min-w-0 max-w-3xl text-lead lg:col-span-7">{t.landing.about.body}</p>
      </div>
    </section>
  );
}

/** Customer quotes — rendered only when there are real, approved quotes (none yet). */
export async function Testimonials() {
  if (COMPANY.testimonials.length === 0) return null;
  const t = await getT();
  return (
    <section aria-labelledby="arvamused-title" data-section="testimonials" className="border-b border-k-line bg-k-paper-2">
      <div className="k-container k-section">
        <h2 id="arvamused-title" className="font-display text-display-2 font-extrabold">
          {t.landing.testimonials.title}
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          {COMPANY.testimonials.map((item) => (
            <li key={`${item.name}-${item.quote}`} className="min-w-0 border-l-4 border-k-volt pl-5">
              <blockquote className="text-lead">„{item.quote}“</blockquote>
              <p className="mt-3 text-sm font-semibold">
                {item.name}
                <span className="font-normal text-k-muted"> · {item.source}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
