import { getT } from "@/lib/i18n/server";

/**
 * The product structure drawn like an engineering sheet: Ettevõte → Objekt →
 * Elektripaigaldis → four modules. Structure is plain grid flow; connector lines are
 * decorative borders, so nothing depends on absolute positioning.
 */
export async function SystemDiagram() {
  const t = await getT();
  const s = t.landing.system;
  const n = s.nodes;
  const modules = [n.log, n.schedule, n.deficiencies, n.documents];

  return (
    <div role="img" aria-label={s.diagramLabel} className="grid">
      <div className="grid max-w-md">
        <Node index="A" node={n.organisation} />
        <Wire />
        <Node index="B" node={n.site} />
        <Wire />
        <Node index="C" node={n.installation} strong />
        <Wire />
      </div>
      {/* Bus: a rail along the left on phones, a horizontal busbar from tablet up. */}
      <ol className="ml-8 grid gap-3 border-l-2 border-k-ink pl-6 sm:ml-10 sm:gap-4 md:ml-0 md:grid-cols-4 md:gap-0 md:border-l-0 md:pl-0">
        {modules.map((module, i) => (
          <li
            key={module.label}
            className="min-w-0 md:border-t-2 md:border-k-ink md:pr-4 md:pt-0 md:first:border-l-0 md:last:pr-0"
          >
            <div aria-hidden="true" className="hidden h-8 w-0.5 bg-k-ink md:ml-10 md:block" />
            <div className="border border-k-ink/70 bg-k-surface px-5 py-4">
              <p className="font-mono text-xs text-k-green">0{i + 1}</p>
              <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-[0.06em] [overflow-wrap:anywhere]">
                {module.label}
              </p>
              <p className="mt-0.5 text-[15px] text-k-muted">{module.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Node({ index, node, strong }: { index: string; node: { label: string; detail: string }; strong?: boolean }) {
  return (
    <div
      className={
        strong
          ? "border-2 border-k-ink bg-k-surface px-5 py-4 sm:px-6"
          : "border border-k-ink/70 bg-k-surface px-5 py-4 sm:px-6"
      }
    >
      <p className="font-mono text-xs text-k-muted">{index}</p>
      <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-[0.08em] sm:text-xl">{node.label}</p>
      <p className="mt-0.5 text-[15px] text-k-muted">{node.detail}</p>
    </div>
  );
}

function Wire() {
  return <div aria-hidden="true" className="ml-8 h-8 w-0.5 bg-k-ink sm:ml-10 sm:h-10" />;
}
