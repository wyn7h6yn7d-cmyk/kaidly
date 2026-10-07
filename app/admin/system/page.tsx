import { Suspense } from "react";
import { AdminTitle, Rows, Section } from "@/components/admin/ui";
import { LoadingBlock } from "@/components/app/states";
import { fmtBytes, fmtNumber } from "@/lib/admin/format";
import { ADMIN } from "@/lib/admin/strings";
import { adminSystem } from "@/lib/data/admin";

async function System() {
  const sys = await adminSystem();
  const s = ADMIN.system;
  // Only non-secret build facts. Keys, URLs with credentials and tokens are never shown.
  const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? s.unknown;
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? s.unknown;
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? s.unknown;
  return (
    <>
      <Rows
        rows={[
          [s.environment, environment],
          [s.branch, branch],
          [s.commit, <code key="c">{commit}</code>],
          [s.latestMigration, <code key="m">{sys.latest_migration ?? s.unknown}</code>],
          [s.migrations, fmtNumber(sys.migrations)],
          [s.users, fmtNumber(sys.users)],
          [s.companies, fmtNumber(sys.companies)],
          [s.documents, fmtNumber(sys.documents)],
          [s.pendingUploads, fmtNumber(sys.pending_uploads)],
          [s.storedFiles, fmtNumber(sys.stored_files)],
          [s.storage, fmtBytes(sys.storage_bytes)],
          [s.admins, fmtNumber(sys.platform_admins)],
        ]}
      />
      <Section id="blockers" title={s.blockers}>
        <ul className="max-w-3xl list-disc space-y-1 pl-5">
          {s.blockerItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

export default function AdminSystemPage() {
  return (
    <>
      <AdminTitle title={ADMIN.system.title} />
      <Suspense fallback={<LoadingBlock lines={5} />}>
        <System />
      </Suspense>
    </>
  );
}
