/**
 * Technical line drawing of a switchboard with operating annotations — the hero's
 * "photo slot". It stands in for real switchgear photography (DESIGN.md D11): once a
 * licensed photo exists it goes underneath this drawing as the background.
 */
export function HeroFigure({
  label,
  title,
  meta,
  callouts,
}: {
  label: string;
  title: string;
  meta: string;
  callouts: readonly string[];
}) {
  const breakers = (y: number, highlight?: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const x = 62 + i * 30;
      const on = i === highlight;
      return (
        <g key={`${y}-${i}`}>
          <rect x={x} y={y} width={22} height={44} fill="none" stroke="currentColor" strokeOpacity={0.75} />
          <rect
            x={x + 7}
            y={y + (on ? 8 : 22)}
            width={8}
            height={14}
            fill={on ? "hsl(var(--k-volt))" : "currentColor"}
            fillOpacity={on ? 1 : 0.55}
          />
        </g>
      );
    });

  return (
    <svg viewBox="0 0 490 560" role="img" aria-label={label} className="h-auto w-full text-white">
      {/* dimension line */}
      <g stroke="currentColor" strokeOpacity={0.45} strokeWidth={1}>
        <line x1={24} y1={60} x2={24} y2={460} />
        <line x1={18} y1={60} x2={30} y2={60} />
        <line x1={18} y1={460} x2={30} y2={460} />
      </g>
      <text x={14} y={270} transform="rotate(-90 14 270)" fill="currentColor" fillOpacity={0.55} fontSize={11} letterSpacing={2} textAnchor="middle">
        1800
      </text>

      {/* cabinet */}
      <rect x={44} y={60} width={210} height={400} fill="none" stroke="currentColor" strokeWidth={2} />
      <rect x={52} y={68} width={194} height={384} fill="none" stroke="currentColor" strokeOpacity={0.35} />
      <rect x={52} y={68} width={194} height={30} fill="currentColor" fillOpacity={0.08} />
      <text x={62} y={88} fill="currentColor" fontSize={13} fontWeight={700} letterSpacing={1.5}>
        PJK-1
      </text>

      {/* busbar + breaker rows */}
      <line x1={58} y1={118} x2={240} y2={118} stroke="hsl(var(--k-volt))" strokeWidth={3} />
      {breakers(132, 1)}
      <line x1={58} y1={196} x2={240} y2={196} stroke="currentColor" strokeOpacity={0.5} />
      {breakers(210)}
      <line x1={58} y1={274} x2={240} y2={274} stroke="currentColor" strokeOpacity={0.5} />
      {breakers(288, 4)}

      {/* meter */}
      <rect x={62} y={362} width={80} height={60} fill="none" stroke="currentColor" strokeOpacity={0.75} />
      <circle cx={102} cy={392} r={16} fill="none" stroke="currentColor" strokeOpacity={0.75} />
      <line x1={102} y1={392} x2={112} y2={382} stroke="hsl(var(--k-volt))" strokeWidth={2} />
      <rect x={160} y={362} width={80} height={60} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />

      {/* outgoing cables */}
      <g stroke="currentColor" strokeOpacity={0.6}>
        {[80, 110, 140, 170, 200, 230].map((x) => (
          <line key={x} x1={x} y1={460} x2={x} y2={548} />
        ))}
      </g>

      {/* callouts */}
      {[
        { y: 154, from: 103, text: callouts[0] },
        { y: 310, from: 193, text: callouts[1] },
        { y: 392, from: 200, text: callouts[2] },
      ].map((c) => (
        <g key={c.text}>
          <circle cx={c.from} cy={c.y} r={4} fill="hsl(var(--k-volt))" />
          <polyline
            points={`${c.from},${c.y} ${c.from + 24},${c.y - 14} 274,${c.y - 14}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.8}
          />
          <text x={280} y={c.y - 10} fill="currentColor" fontSize={13} fontWeight={600}>
            {c.text}
          </text>
        </g>
      ))}

      {/* title block, as on a drawing */}
      <g>
        <rect x={274} y={470} width={176} height={78} fill="none" stroke="currentColor" strokeOpacity={0.7} />
        <line x1={274} y1={500} x2={450} y2={500} stroke="currentColor" strokeOpacity={0.4} />
        <text x={284} y={490} fill="currentColor" fontSize={12} fontWeight={700} letterSpacing={0.5}>
          {title}
        </text>
        <text x={284} y={520} fill="currentColor" fillOpacity={0.7} fontSize={11}>
          {meta}
        </text>
        <text x={284} y={538} fill="currentColor" fillOpacity={0.5} fontSize={10} letterSpacing={2}>
          KAIDLY
        </text>
      </g>
    </svg>
  );
}
