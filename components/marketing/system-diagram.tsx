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
    <div role="img" aria-label={s.diagramLabel} className="grid grid-cols-1">
      <div className="grid w-full max-w-md grid-cols-1 lg:max-w-2xl xl:max-w-3xl">
        <Node index="A" node={n.organisation} />
        <Wire />
        <Node index="B" node={n.site} />
        <Wire />
        <Node index="C" node={n.installation} strong />
        <Wire />
      </div>
      {/* Bus: a rail along the left on phones, a horizontal busbar from tablet up. */}
      <ol className="ml-8 grid grid-cols-1 gap-3 border-l-2 border-k-ink pl-6 sm:ml-10 sm:gap-4 md:ml-0 md:grid-cols-4 md:gap-0 md:border-l-0 md:pl-0 lg:ml-0">
        {modules.map((module, i) => (
          <li
            key={module.label}
            className="min-w-0 md:border-t-2 md:border-k-ink md:pr-4 md:pt-0 md:first:border-l-0 md:last:pr-0 lg:pr-6"
          >
            <div aria-hidden="true" className="hidden h-8 w-0.5 bg-k-ink md:ml-10 md:block lg:ml-12 lg:h-12" />
            <div className="border border-k-ink/70 bg-k-surface px-5 py-4 lg:px-7 lg:py-7 xl:py-8">
              <p className="font-mono text-sm text-k-green">0{i + 1}</p>
              <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-[0.04em] [overflow-wrap:anywhere] lg:text-xl xl:text-[1.75rem]">
                {module.label}
              </p>
              <p className="mt-1 text-[15px] text-k-muted lg:text-base xl:text-lg">{module.detail}</p>
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
          ? "border-2 border-k-ink bg-k-surface px-5 py-4 sm:px-6 lg:px-8 lg:py-7"
          : "border border-k-ink/70 bg-k-surface px-5 py-4 sm:px-6 lg:px-8 lg:py-7"
      }
    >
      <p className="font-mono text-sm text-k-muted">{index}</p>
      <p className="mt-1 font-display text-lg font-extrabold uppercase tracking-[0.05em] [overflow-wrap:anywhere] sm:text-xl lg:text-2xl xl:text-[1.75rem]">{node.label}</p>
      <p className="mt-1 text-[15px] text-k-muted lg:text-lg xl:text-xl">{node.detail}</p>
    </div>
  );
}

function Wire() {
  return <div aria-hidden="true" className="ml-8 h-8 w-0.5 bg-k-ink sm:ml-10 sm:h-10 lg:ml-12 lg:h-12" />;
}
