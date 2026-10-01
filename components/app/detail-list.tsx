/** Read-only label/value rows for master data. Empty values show a dash. */
export function DetailList({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="border-t border-k-line">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid gap-1 border-b border-k-line py-3 sm:grid-cols-[220px_1fr] sm:gap-6"
        >
          <dt className="text-sm font-semibold text-k-muted">{item.label}</dt>
          <dd className="min-w-0 whitespace-pre-line break-words">
            {item.value === null || item.value === undefined || item.value === "" ? "—" : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
