/**
 * The hero drawing: a maintenance sheet for switchboard PK-01. Two layers —
 *   1. a neat technical drawing in ink (cabinet, breaker rows, meter, dimension line,
 *      title block), as on a drafted sheet;
 *   2. field notes on top in KAIDLY green: slightly imperfect pen lines, arrows, ticks, a
 *      circled date and short handwritten labels (the page's Caveat face, --font-hand).
 * Deliberately restrained: the notes annotate the drawing, they never become body copy.
 * Phones get fewer marks (`hidden sm:inline` groups) so the sheet doesn't crowd.
 */

type Pt = readonly [number, number];

/** A pen stroke between two points: a gentle bow with a tiny overshoot, not a ruler line. */
function stroke([x1, y1]: Pt, [x2, y2]: Pt, bow = 6): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // bow perpendicular to the direction
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return `M${x1} ${y1} Q${(mx + nx * bow).toFixed(1)} ${(my + ny * bow).toFixed(1)} ${x2} ${y2}`;
}

/** Hand-drawn arrow: a bowed shaft and two short, unequal head strokes. */
function Arrow({ from, to, bow = 6 }: { from: Pt; to: Pt; bow?: number }) {
  const [x2, y2] = to;
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const head = (da: number, l: number) =>
    `M${x2} ${y2} L${(x2 - l * Math.cos(a + da)).toFixed(1)} ${(y2 - l * Math.sin(a + da)).toFixed(1)}`;
  return (
    <g>
      <path d={stroke(from, to, bow)} />
      <path d={head(0.45, 11)} />
      <path d={head(-0.5, 9)} />
    </g>
  );
}

/** A quick tick mark. */
function Tick({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path d={`M${x} ${y} q${3 * s} ${4 * s} ${5 * s} ${7 * s} q${4 * s} ${-12 * s} ${12 * s} ${-18 * s}`} />;
}

export function HeroFigure({
  label,
  title,
  meta,
  notes,
  date,
  tag = "PK-01",
}: {
  tag?: string;
  label: string;
  title: string;
  meta: string;
  /** [inspection done, measurement date, next service, deficiency cleared] */
  notes: readonly string[];
  /** The circled date next to the inspection note. */
  date: string;
}) {
  const breakers = (y: number, highlight?: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const x = 74 + i * 30;
      const on = i === highlight;
      return (
        <g key={`${y}-${i}`}>
          <rect x={x} y={y} width={22} height={44} rx={1} fill="none" stroke="currentColor" strokeOpacity={0.7} />
          <rect
            x={x + 7}
            y={y + (on ? 8 : 22)}
            width={8}
            height={14}
            fill={on ? "hsl(var(--k-volt))" : "currentColor"}
            fillOpacity={on ? 1 : 0.45}
          />
        </g>
      );
    });

  // A thin paper-coloured halo behind the handwriting lifts it off the grid and drawing lines
  // (paint-order: stroke first) — more legible without looking bold or typeset.
  const hand = {
    fontFamily: "var(--font-hand), cursive",
    fontWeight: 600,
    stroke: "hsl(var(--k-surface))",
    strokeWidth: 4,
    paintOrder: "stroke",
    strokeLinejoin: "round",
  } as const;

  return (
    <svg viewBox="0 0 520 600" role="img" aria-label={label} className="h-auto w-full text-k-ink">
      {/* ===== Layer 1: the drafted drawing (ink) ===== */}
      <g>
        {/* dimension line */}
        <g stroke="currentColor" strokeOpacity={0.4}>
          <line x1={34} y1={72} x2={34} y2={472} />
          <line x1={28} y1={72} x2={40} y2={72} />
          <line x1={28} y1={472} x2={40} y2={472} />
        </g>
        <text x={24} y={282} transform="rotate(-90 24 282)" fill="currentColor" fillOpacity={0.5} fontSize={11} letterSpacing={2} textAnchor="middle">
          1800
        </text>

        {/* cabinet */}
        <rect x={56} y={72} width={210} height={400} fill="hsl(var(--k-surface))" stroke="currentColor" strokeWidth={1.8} />
        <rect x={64} y={80} width={194} height={384} fill="none" stroke="currentColor" strokeOpacity={0.3} />
        <rect x={64} y={80} width={194} height={30} fill="currentColor" fillOpacity={0.05} />
        <text x={74} y={100} fill="currentColor" fontSize={13} fontWeight={700} letterSpacing={1.5}>
          {tag}
        </text>

        {/* busbar + breaker rows */}
        <line x1={70} y1={130} x2={252} y2={130} stroke="hsl(var(--k-green))" strokeWidth={3} />
        {breakers(144, 1)}
        <line x1={70} y1={208} x2={252} y2={208} stroke="currentColor" strokeOpacity={0.4} />
        {breakers(222)}
        <line x1={70} y1={286} x2={252} y2={286} stroke="currentColor" strokeOpacity={0.4} />
        {breakers(300, 4)}

        {/* meter + empty slot */}
        <rect x={74} y={374} width={80} height={60} fill="none" stroke="currentColor" strokeOpacity={0.7} />
        <circle cx={114} cy={404} r={16} fill="none" stroke="currentColor" strokeOpacity={0.7} />
        <line x1={114} y1={404} x2={124} y2={394} stroke="hsl(var(--k-green))" strokeWidth={2} />
        <rect x={172} y={374} width={80} height={60} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />

        {/* outgoing cables */}
        <g stroke="currentColor" strokeOpacity={0.5}>
          {[92, 122, 152, 182, 212, 242].map((x) => (
            <line key={x} x1={x} y1={472} x2={x} y2={560} />
          ))}
        </g>

        {/* title block */}
        <g>
          <rect x={300} y={482} width={190} height={78} fill="hsl(var(--k-surface))" stroke="currentColor" strokeOpacity={0.6} />
          <line x1={300} y1={512} x2={490} y2={512} stroke="currentColor" strokeOpacity={0.35} />
          <text x={310} y={502} fill="currentColor" fontSize={12} fontWeight={700} letterSpacing={0.5}>
            {title}
          </text>
          <text x={310} y={532} fill="currentColor" fillOpacity={0.65} fontSize={11}>
            {meta}
          </text>
          <text x={310} y={550} fill="currentColor" fillOpacity={0.45} fontSize={10} letterSpacing={2}>
            KAIDLY
          </text>
        </g>
      </g>

      {/* ===== Layer 2: field notes (green pen) ===== */}
      <g
        fill="none"
        stroke="hsl(var(--k-green))"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "hsl(var(--k-green))" }}
      >
        {/* 1 · inspection done, with the circled date */}
        <path d="M100 136 c-14 2 -18 18 -10 30 c8 12 26 12 32 0 c5 -11 -3 -26 -18 -28" strokeOpacity={0.95} />
        <Arrow from={[132, 150]} to={[296, 120]} bow={-10} />
        <Tick x={304} y={114} s={0.9} />
        <text x={326} y={124} fill="currentColor" fontSize={25} style={hand}>
          {notes[0]}
        </text>
        <g className="hidden sm:inline">
          <text x={336} y={160} fill="currentColor" fontSize={21} style={hand}>
            {date}
          </text>
          <path d="M330 150 c2 -16 44 -18 56 -6 c10 10 -6 22 -30 22 c-20 0 -32 -8 -24 -20" strokeOpacity={0.9} />
        </g>

        {/* row 2: quick ticks along the breakers */}
        <g className="hidden sm:inline" strokeOpacity={0.88}>
          <Tick x={78} y={276} s={0.7} />
          <Tick x={108} y={276} s={0.7} />
          <Tick x={138} y={276} s={0.7} />
        </g>

        {/* 2 · measurement date, around the highlighted breaker in row 3 */}
        <path d="M198 302 c-6 -8 24 -12 30 -2 c6 10 4 40 -2 46 c-8 8 -30 4 -30 -6 c0 -12 0 -30 4 -38" strokeOpacity={0.95} />
        <Arrow from={[232, 316]} to={[296, 290]} bow={-6} />
        <text x={304} y={294} fill="currentColor" fontSize={25} style={hand}>
          {notes[1]}
        </text>
        <path d={stroke([306, 302], [446, 300], 2)} strokeOpacity={0.75} strokeWidth={1.6} />

        {/* 3 · next service, from the meter */}
        <Arrow from={[140, 380]} to={[296, 366]} bow={-12} />
        <text x={304} y={370} fill="currentColor" fontSize={25} style={hand}>
          {notes[2]}
        </text>

        {/* 4 · deficiency cleared, from the empty slot */}
        <Arrow from={[252, 420]} to={[296, 432]} bow={4} />
        <Tick x={304} y={430} s={0.9} />
        <text x={326} y={440} fill="currentColor" fontSize={25} style={hand}>
          {notes[3]}
        </text>
      </g>
    </svg>
  );
}
