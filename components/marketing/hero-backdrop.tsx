/**
 * Decorative hero surface: an engineering-paper grid (CSS gradients) as the main layer,
 * with a few faint raised/recessed panels as a secondary layer around the illustration.
 * No images, no animation; hidden from assistive tech; masked so the area behind the
 * headline stays calm; phones get a lighter grid and fewer panels.
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

function Tiles({ tiles }: { tiles: Tile[] }) {
  return (
    <>
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

/** Drafting-paper grid: fine lines every `cell` px, a slightly stronger line every 5 cells. */
export function grid(cell: number, fine: number, major: number): React.CSSProperties {
  const line = (o: number) => `rgba(17, 24, 39, ${o})`;
  return {
    backgroundImage: [
      `linear-gradient(to right, ${line(major)} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${line(major)} 1px, transparent 1px)`,
      `linear-gradient(to right, ${line(fine)} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${line(fine)} 1px, transparent 1px)`,
    ].join(", "),
    backgroundSize: `${cell * 5}px ${cell * 5}px, ${cell * 5}px ${cell * 5}px, ${cell}px ${cell}px, ${cell}px ${cell}px`,
    backgroundPosition: "-1px -1px",
  };
}

export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      {/* 1. The engineering grid — the main background language. Calmer behind the text. */}
      <div
        className="absolute inset-0 hidden sm:block [mask-image:linear-gradient(90deg,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.5)_40%,#000_70%)]"
        style={grid(40, 0.05, 0.075)}
      />
      <div
        className="absolute inset-0 sm:hidden [mask-image:linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.35)_45%,#000_85%)]"
        style={grid(32, 0.04, 0.06)}
      />
      {/* 2. Soft panels — secondary, faint, mostly beside and around the illustration. */}
      <svg
        className="absolute inset-0 hidden size-full opacity-55 sm:block [mask-image:linear-gradient(90deg,transparent_0%,transparent_45%,rgba(0,0,0,0.6)_62%,#000_80%)]"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMaxYMid slice"
        focusable="false"
      >
        <Tiles tiles={DESKTOP} />
      </svg>
      <svg
        className="absolute inset-0 size-full opacity-50 sm:hidden [mask-image:linear-gradient(180deg,transparent_0%,transparent_55%,#000_85%)]"
        viewBox="0 0 400 860"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
      >
        <Tiles tiles={MOBILE} />
      </svg>
    </div>
  );
}
