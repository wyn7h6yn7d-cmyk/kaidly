import Image from "next/image";
import { getT } from "@/lib/i18n/server";
import { HeroFigure } from "./hero-figure";

/**
 * The hero's visual slot. Intended: real, licensed photography of electrical switchgear
 * with a few KAIDLY annotations (DESIGN.md D11). Until such a photo exists in the
 * repository, the slot shows the technical drawing — never a stock or unlicensed image.
 *
 * To use a photo: add it under public/landing/ (licence recorded in docs/DESIGN.md) and set
 * HERO_PHOTO. It then shows faintly under the sketched sheet.
 */
const HERO_PHOTO: { src: string; width: number; height: number } | null = null;

export async function HeroVisual() {
  const t = await getT();
  const h = t.landing.hero;
  return (
    <figure className="relative">
      {/* A faint pencil trace leading in from the copy (wide screens only). */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 160 120"
        className="pointer-events-none absolute -left-36 bottom-10 hidden w-40 text-k-green/30 xl:block"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeDasharray="5 6"
      >
        <path d="M6 100 C40 104 70 90 96 66 C114 50 128 40 150 34" />
        <path d="M150 34 L139 31 M150 34 L143 43" strokeDasharray="none" />
      </svg>
      <div className="relative overflow-hidden rounded-sm border border-k-line bg-k-surface shadow-[0_1px_2px_rgba(17,24,39,0.05),0_12px_32px_-18px_rgba(17,24,39,0.25)] lg:rotate-[0.6deg]">
        {HERO_PHOTO && (
          <Image
            src={HERO_PHOTO.src}
            width={HERO_PHOTO.width}
            height={HERO_PHOTO.height}
            alt=""
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="absolute inset-0 size-full object-cover opacity-20"
          />
        )}
        {/* grid paper */}
        <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 text-k-ink/[0.07]" />
        <div className="relative mx-auto w-full max-w-[680px] px-4 py-6 sm:px-8 sm:py-9 xl:px-6 xl:py-7">
          <HeroFigure label={h.figureLabel} title={h.figureTitle} meta={h.figureMeta} notes={h.figureNotes} date={h.figureDate} />
        </div>
      </div>
    </figure>
  );
}
