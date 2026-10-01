"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { changeMemberRole } from "@/lib/actions/organisations";
import { initialState } from "@/lib/actions/state";
import type { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";

export function MemberRoleForm({
  memberId,
  current,
  options,
  label,
}: {
  memberId: string;
  current: Role;
  options: Role[];
  label: string;
}) {
  const [state, action, pending] = useActionState(changeMemberRole, initialState);
  const selectId = `role-${memberId}`;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <Select id={selectId} name="role" defaultValue={current} className="h-9 min-w-40 text-[15px]">
          {options.map((role) => (
            <option key={role} value={role}>
              {t.roles[role]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {t.app.save}
        </Button>
      </div>
      <FormMessage error={state.error} success={state.ok ? t.app.members.roleChanged : undefined} />
    </form>
  );
}
