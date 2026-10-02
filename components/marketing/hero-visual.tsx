import Image from "next/image";
import { getT } from "@/lib/i18n/server";
import { HeroFigure } from "./hero-figure";

/**
 * The hero's visual slot. Intended: real, licensed photography of electrical switchgear
 * with a few KAIDLY annotations (DESIGN.md D11). Until such a photo exists in the
 * repository, the slot shows the technical drawing — never a stock or unlicensed image.
 *
 * To use a photo: add it under public/landing/ (licence recorded in docs/DESIGN.md) and set
 * HERO_PHOTO. The annotated drawing then sits over the photo at reduced opacity.
 */
const HERO_PHOTO: { src: string; width: number; height: number } | null = null;

export async function HeroVisual() {
  const t = await getT();
  const h = t.landing.hero;
  return (
    <figure className="k-grain relative overflow-hidden bg-k-green">
      {HERO_PHOTO && (
        <Image
          src={HERO_PHOTO.src}
          width={HERO_PHOTO.width}
          height={HERO_PHOTO.height}
          alt=""
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="absolute inset-0 size-full object-cover opacity-60"
        />
      )}
      <div aria-hidden="true" className="k-grid pointer-events-none absolute inset-0 text-white/[0.05]" />
      <div className="relative mx-auto w-full max-w-[680px] px-6 py-8 sm:px-10 sm:py-12 xl:px-7 xl:py-9">
        <HeroFigure label={h.figureLabel} title={h.figureTitle} meta={h.figureMeta} callouts={h.callouts} />
      </div>
    </figure>
  );
}
