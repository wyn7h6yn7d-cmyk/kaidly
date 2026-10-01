import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Node = { label: string; detail: string };

/**
 * A terminal: square marker with the label beside it. With `trunk`, a line continues down
 * from the marker along the label, like a conductor in a single-line diagram.
 */
function Terminal({ node, index, trunk }: { node: Node; index: string; trunk?: boolean }) {
  return (
    <div className="flex gap-4">
      <div aria-hidden="true" className="flex w-3 shrink-0 flex-col items-center">
        <span className="mt-1 size-3 shrink-0 border-2 border-k-ink bg-k-paper" />
        {trunk && <span className="w-px flex-1 bg-k-ink" />}
      </div>
      <div className="pb-1">
        <p className="font-mono text-[11px] leading-none text-k-muted">{index}</p>
        <p className="mt-1.5 font-display text-lg font-extrabold uppercase leading-tight tracking-[0.06em]">
          {node.label}
        </p>
        <p className="mt-0.5 text-sm text-k-muted">{node.detail}</p>
      </div>
    </div>
  );
}

/**
 * The KAIDLY structure drawn like a single-line diagram: site → installation → busbar with
 * four outgoing branches. Columns have no gaps so every connector meets its terminal
 * exactly (terminal centres sit at 6 px from each column edge).
 */
export function SystemDiagram() {
  const n = t.landing.system.nodes;
  const branches = [
    { node: n.log, index: "Q1" },
    { node: n.schedule, index: "Q2" },
    { node: n.deficiencies, index: "Q3" },
    { node: n.documents, index: "Q4" },
  ];

  return (
    <figure aria-label={t.landing.system.diagramLabel}>
      {/* phones: vertical trunk with branches to the right */}
      <div className="md:hidden">
        <Terminal node={n.site} index="A" trunk />
        <div aria-hidden="true" className="ml-[5.5px] h-6 w-px bg-k-ink" />
        <Terminal node={n.installation} index="B" trunk />
        <ul className="relative ml-[5px]">
          <span aria-hidden="true" className="absolute bottom-[calc(100%-1.6rem)] left-0 top-0 w-[3px] bg-k-green" />
          {branches.map((b, i) => (
            <li key={b.index} className={cn("relative pl-8", i === 0 ? "pt-4" : "pt-5")}>
              <span aria-hidden="true" className="absolute left-0 top-[calc(theme(spacing.5)+0.55rem)] h-px w-8 bg-k-ink" />
              <div className="-ml-0.5">
                <Terminal node={b.node} index={b.index} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* tablet and up: horizontal */}
      <div className="hidden md:block">
        <div className="relative grid grid-cols-4">
          <span aria-hidden="true" className="absolute left-[12px] top-[10px] h-px w-[calc(50%-12px)] bg-k-ink" />
          <div className="pr-6">
            <Terminal node={n.site} index="A" />
          </div>
          <div />
          <div className="pr-6">
            <Terminal node={n.installation} index="B" trunk />
          </div>
          <div />
        </div>
        <div aria-hidden="true" className="relative h-10">
          <span className="absolute left-[calc(50%+5.5px)] top-0 h-full w-px bg-k-ink" />
          <span className="absolute bottom-0 left-[5px] h-[3px] w-[calc(75%+1px)] bg-k-green" />
        </div>
        <ul className="grid grid-cols-4">
          {branches.map((b) => (
            <li key={b.index} className="pr-6">
              <div aria-hidden="true" className="ml-[5.5px] h-7 w-px bg-k-ink" />
              <Terminal node={b.node} index={b.index} />
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
