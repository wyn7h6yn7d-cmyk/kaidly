"use client";

import { useState } from "react";
import { adminSetMemberRole } from "@/lib/actions/admin";
import { ADMIN } from "@/lib/admin/strings";
import { ROLES } from "@/lib/auth/roles";
import { ConfirmAction } from "./confirm-action";

export function RoleChange({
  membershipId,
  current,
  who,
  company,
}: {
  membershipId: string;
  current: string;
  who: string;
  company: string;
}) {
  const [role, setRole] = useState(current);
  const id = `role-${membershipId}`;
  return (
    <div className="flex flex-wrap items-start gap-2">
      <label htmlFor={id} className="sr-only">
        {ADMIN.user.changeRole}
      </label>
      <select
        id={id}
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="min-h-11 rounded-sm border border-k-line bg-k-surface px-2 text-base sm:min-h-9 sm:text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ADMIN.roles[r]}
          </option>
        ))}
      </select>
      {role !== current && (
        <ConfirmAction
          action={adminSetMemberRole}
          fields={{ membershipId, role }}
          label={ADMIN.user.changeRole}
          title={ADMIN.user.changeRole}
          body={`${who} · ${company}: ${ADMIN.roles[current]} → ${ADMIN.roles[role]}`}
        />
      )}
    </div>
  );
}
