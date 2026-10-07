"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createDocument } from "@/lib/actions/documents";
import { LINK_CATEGORIES } from "@/lib/documents/rules";
import { useT } from "@/lib/i18n/client";
import { DocumentLinkField } from "./photos-link";

type Choice = { id: string; label: string };

/**
 * A document in the register: title, category, where it belongs and the external link to
 * the document or its folder. Admins choose any scope; operators only installations (the
 * database enforces the same rule). Typed values stay if anything fails.
 */
export function DocumentForm({
  orgSlug,
  canUseGeneralScopes,
  sites,
  installations,
  defaultScope,
  cancelHref,
}: {
  orgSlug: string;
  canUseGeneralScopes: boolean;
  sites: Choice[];
  installations: Choice[];
  defaultScope: string;
  cancelHref: string;
}) {
  const t = useT();
  const [state, action, pending, value] = useFormAction(createDocument);
  const id = useFieldId();
  const copy = t.app.documents;
  const scope = value("scope", defaultScope);

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <Field id={id("title")} label={copy.fields.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          defaultValue={value("title")}
          aria-invalid={state.fields?.title}
        />
      </Field>

      <DocumentLinkField id={id("externalUrl")} defaultValue={value("externalUrl")} invalid={state.fields?.externalUrl} required />

      <Field id={id("category")} label={copy.fields.category}>
        <Select key={value("category", "other")} id={id("category")} name="category" defaultValue={value("category", "other")}>
          {LINK_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {copy.categories[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field id={id("scope")} label={copy.fields.scope} hint={canUseGeneralScopes ? undefined : copy.adminOnlyScope}>
        <Select
          key={scope}
          id={id("scope")}
          name="scope"
          required
          defaultValue={scope}
          aria-describedby={canUseGeneralScopes ? undefined : `${id("scope")}-hint`}
          aria-invalid={state.fields?.scope}
        >
          {!scope && <option value="">—</option>}
          {canUseGeneralScopes && <option value="org">{copy.fields.scopeOrganisation}</option>}
          {canUseGeneralScopes && sites.length > 0 && (
            <optgroup label={copy.fields.site}>
              {sites.map((site) => (
                <option key={site.id} value={`site:${site.id}`}>
                  {site.label}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={copy.fields.installation}>
            {installations.map((installation) => (
              <option key={installation.id} value={`inst:${installation.id}`}>
                {installation.label}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>

      <FormMessage code={state.errorCode} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending} className="sm:min-w-[224px]">
          {pending ? t.app.saving : copy.addSubmit}
        </Button>
      </div>
    </form>
  );
}
