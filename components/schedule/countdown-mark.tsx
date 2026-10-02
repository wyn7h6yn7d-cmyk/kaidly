import type { CountdownLevel } from "@/lib/schedule";
import { cn } from "@/lib/utils";

// Colour supports the words, never replaces them; only the last week, today and overdue
// get coloured text. Shared by server pages, notifications and the toast.
const SQUARE: Record<CountdownLevel | "done", string> = {
  neutral: "bg-k-grey/60",
  aware: "border border-k-warn bg-transparent",
  warning: "bg-k-warn",
  strong: "bg-k-warn",
  today: "bg-k-warn",
  overdue: "bg-k-danger",
  done: "bg-k-green",
};
const TEXT: Record<CountdownLevel | "done", string> = {
  neutral: "text-k-ink",
  aware: "text-k-ink",
  warning: "text-k-ink",
  strong: "font-semibold text-k-warn",
  today: "font-semibold text-k-warn",
  overdue: "font-semibold text-k-danger",
  done: "text-k-ink",
};

export function CountdownMark({ level, text }: { level: CountdownLevel | "done"; text: string }) {
  return (
    <span data-level={level} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium", TEXT[level])}>
      <span aria-hidden="true" className={cn("size-2.5 shrink-0", SQUARE[level])} />
      {text}
    </span>
  );
}
