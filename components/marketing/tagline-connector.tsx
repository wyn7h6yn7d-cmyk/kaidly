/**
 * Decorative pen stroke that continues from the handwritten tagline to the hero sheet:
 * a short solid continuation after the last word, a lighter dashed pencil line with a
 * shallow dip, and a small hand-drawn arrowhead at the sheet's left edge.
 *
 * It fills the rest of the tagline row (flex-1), so it starts where the phrase ends in any
 * language, and runs on a little past the copy column into the gap, stopping just short of
 * the sheet (the sheet is scaled 7 % on xl, so the overshoot is smaller there). The line
 * stretches with the row while strokes keep their width (`vector-effect`); the arrowhead
 * is a separate fixed-size drawing. Full connector from xl, where the sheet sits level
 * with the tagline; at lg (sheet above the tagline) only a short pen flourish; stacked
 * layouts (phones, tablets) get nothing. Hidden from assistive tech, not focusable, no
 * interaction.
 */
export function TaglineConnector() {
  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 40 40"
        className="pointer-events-none ml-2 hidden h-[1em] w-10 shrink-0 self-center text-k-green lg:block xl:hidden"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        <path d="M1 22 C10 24.5 22 25.5 38 23" strokeWidth={1.6} strokeOpacity={0.7} />
      </svg>
      <TaglineArrow />
    </>
  );
}

function TaglineArrow() {
  return (
    <span aria-hidden="true" className="pointer-events-none relative ml-3 hidden min-w-16 flex-1 self-stretch xl:block">
      <span className="absolute inset-y-0 left-0 w-[calc(100%+0.5rem)]">
        <svg
          focusable="false"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible text-k-green"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
        >
          {/* the pen lifts off the last word … */}
          <path d="M0 22 C2.5 23.4 5.5 24.6 9 25.2" strokeWidth={1.6} strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
          {/* … and the thought continues as a light pencil line, dipping slightly, then rising */}
          <path
            d="M10.5 25.4 C24 27.8 38 29.2 52 27.4 C66 25.6 80 20.8 98.6 17.2"
            strokeWidth={1.5}
            strokeOpacity={0.48}
            strokeDasharray="5 6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* arrowhead: two short, unequal strokes, not a UI icon */}
        <svg
          focusable="false"
          viewBox="0 0 16 16"
          className="absolute right-0 top-[43%] size-4 -translate-y-1/2 overflow-visible text-k-green"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeOpacity={0.68}
        >
          <path d="M15 7.2 L4.6 3.4" />
          <path d="M15 7.2 L6 13.6" />
        </svg>
      </span>
    </span>
  );
}
