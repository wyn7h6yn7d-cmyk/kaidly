"use client";

import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { changeMemberRole } from "@/lib/actions/organisations";
import type { Role } from "@/lib/auth/roles";
import { t } from "@/lib/i18n";
import { useFieldId } from "@/components/forms/use-field-id";

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
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(changeMemberRole);
  const selectId = id(`role-${memberId}`);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="memberId" value={memberId} />
      <label htmlFor={selectId} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <Select
          key={value("role", current)}
          id={selectId}
          name="role"
          defaultValue={value("role", current)}
          className="h-11 min-w-40 text-[15px] sm:h-9"
        >
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
