/**
 * Decorative hero surface: oversized soft tiles on a faint technical grid, like a
 * control-panel face — some raised (light top edge, soft shadow below), some recessed.
 * Static inline SVG (a few kB, no images, no animation), hidden from assistive tech,
 * masked so the area behind the headline stays calm; phones get fewer, larger shapes.
 */

type Tile = { x: number; y: number; w: number; h: number; kind: "raised" | "recessed" | "accent" };

const DESKTOP: Tile[] = [
  { x: 980, y: 50, w: 250, h: 190, kind: "raised" },
  { x: 1250, y: 50, w: 310, h: 330, kind: "recessed" },
  { x: 880, y: 270, w: 190, h: 190, kind: "raised" },
  { x: 1090, y: 410, w: 440, h: 250, kind: "raised" },
  { x: 840, y: 490, w: 220, h: 330, kind: "recessed" },
  { x: 1180, y: 690, w: 170, h: 170, kind: "accent" },
  { x: 1370, y: 690, w: 200, h: 180, kind: "recessed" },
  { x: 560, y: 720, w: 250, h: 150, kind: "raised" },
];

const MOBILE: Tile[] = [
  { x: 200, y: 470, w: 260, h: 220, kind: "raised" },
  { x: -60, y: 640, w: 230, h: 200, kind: "recessed" },
  { x: 230, y: 715, w: 170, h: 120, kind: "accent" },
];

function Tiles({ tiles, id }: { tiles: Tile[]; id: string }) {
  return (
    <>
      <defs>
        <pattern id={`${id}-grid`} width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0H0V50" fill="none" stroke="#111827" strokeOpacity="0.035" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-grid)`} />
      {tiles.map((t, i) =>
        t.kind === "raised" ? (
          <g key={i}>
            {/* soft shadow: the same tile, a few px lower, very faint */}
            <rect x={t.x} y={t.y + 6} width={t.w} height={t.h} rx="28" fill="#111827" fillOpacity="0.035" />
            <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="28" fill="#EFEDE9" stroke="#111827" strokeOpacity="0.06" />
            <path d={`M${t.x + 28} ${t.y + 1.5}H${t.x + t.w - 28}`} stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
          </g>
        ) : t.kind === "recessed" ? (
          <g key={i}>
            <rect x={t.x} y={t.y} width={t.w} height={t.h} rx="28" fill="#DEDBD5" fillOpacity="0.55" stroke="#111827" strokeOpacity="0.07" />
            <path d={`M${t.x + 28} ${t.y + 3}H${t.x + t.w - 28}`} stroke="#111827" strokeOpacity="0.05" strokeWidth="3" />
          </g>
        ) : (
          <rect key={i} x={t.x} y={t.y} width={t.w} height={t.h} rx="28" fill="#0F3D32" fillOpacity="0.06" />
        ),
      )}
    </>
  );
}

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      <svg
        className="absolute inset-0 hidden size-full sm:block [mask-image:linear-gradient(90deg,transparent_0%,rgba(0,0,0,0.25)_38%,#000_62%)]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMaxYMid slice"
        focusable="false"
      >
        <Tiles tiles={DESKTOP} id="hero-d" />
      </svg>
      <svg
        className="absolute inset-0 size-full sm:hidden [mask-image:linear-gradient(180deg,transparent_0%,transparent_45%,#000_80%)]"
        viewBox="0 0 400 860"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
      >
        <Tiles tiles={MOBILE} id="hero-m" />
      </svg>
    </div>
  );
}
