import Link from "next/link";
import { Suspense } from "react";
import { AdminTitle } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { ADMIN } from "@/lib/admin/strings";
import { adminArchiveChurn } from "@/lib/data/admin";

// Reads request data (session, language cookie, params): allowed to block on navigation
// instead of claiming an instant static shell (Next 16.4 instant validation).
export const instant = false;

async function Churn() {
  const rows = await adminArchiveChurn(30, 5);
  const a = ADMIN.archive;
  if (rows.length === 0) return <p className="text-k-muted">{a.empty}</p>;
  return (
    <div className="max-w-3xl overflow-x-auto">
      <table className="w-full border-collapse text-left" data-testid="archive-churn">
        <thead>
          <tr className="border-b border-k-line">
            <th className="py-2 pr-4">{a.company}</th>
            <th className="py-2 pr-4 text-right">{a.archives}</th>
            <th className="py-2 text-right">{a.restores}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.organisation_id} className="border-b border-k-line">
              <td className="py-2 pr-4">
                <Link href={`/admin/companies/${r.organisation_id}`} className="font-semibold text-k-green underline underline-offset-4">
                  {r.name}
                </Link>
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">{r.archives}</td>
              <td className="py-2 text-right tabular-nums">{r.restores}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminArchivePage() {
  return (
    <>
      <AdminTitle title={ADMIN.archive.title} intro={ADMIN.archive.intro} />
      <Suspense fallback={<LoadingBlock lines={3} />}>
        <Churn />
      </Suspense>
    </>
  );
}
