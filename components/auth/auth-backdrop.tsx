import { grid } from "@/components/marketing/hero-backdrop";

/**
 * Auth pages: the landing hero's engineering-paper grid, quieter, faded out behind the
 * form, with a few very faint raised panels toward the edges on wide screens.
 * Decorative only: hidden from assistive tech, not focusable, no images, no animation.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          ...grid(40, 0.035, 0.055),
          maskImage: "radial-gradient(ellipse 34rem 30rem at 50% 45%, rgba(0,0,0,0.25) 0%, #000 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 34rem 30rem at 50% 45%, rgba(0,0,0,0.25) 0%, #000 100%)",
        }}
      />
      <svg
        focusable="false"
        className="absolute inset-0 hidden h-full w-full opacity-40 lg:block"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <g fill="#EFEDE9" stroke="#111827" strokeOpacity="0.06">
          <rect x="80" y="120" width="260" height="190" rx="28" />
          <rect x="1280" y="80" width="240" height="300" rx="28" />
          <rect x="1180" y="600" width="320" height="200" rx="28" />
        </g>
        <rect x="140" y="560" width="220" height="240" rx="28" fill="#DEDBD5" fillOpacity="0.55" stroke="#111827" strokeOpacity="0.07" />
        <rect x="1340" y="420" width="140" height="140" rx="28" fill="#0F3D32" fillOpacity="0.05" />
      </svg>
    </div>
  );
}
