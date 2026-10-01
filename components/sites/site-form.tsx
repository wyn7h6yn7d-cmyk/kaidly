"use client";

import Link from "next/link";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSite, updateSite } from "@/lib/actions/sites";
import type { Site } from "@/lib/data/sites";
import { t } from "@/lib/i18n";
import { useFieldId } from "@/components/forms/use-field-id";

export function SiteForm({
  orgSlug,
  site,
  cancelHref,
}: {
  orgSlug: string;
  site?: Site;
  cancelHref: string;
}) {
  const id = useFieldId();
  const [state, action, pending, value] = useFormAction(site ? updateSite : createSite);
  const f = t.app.sites.fields;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      {site && <input type="hidden" name="siteId" value={site.id} />}
      <Field id={id("name")} label={f.name}>
        <Input
          id={id("name")}
          name="name"
          required
          maxLength={200}
          placeholder={f.namePlaceholder}
          defaultValue={value("name", site?.name)}
          aria-invalid={state.fields?.name}
        />
      </Field>
      <Field id={id("address")} label={f.address} optional>
        <Input
          id={id("address")}
          name="address"
          maxLength={300}
          autoComplete="street-address"
          defaultValue={value("address", site?.address)}
          aria-invalid={state.fields?.address}
        />
      </Field>
      <Field id={id("responsiblePerson")} label={f.responsiblePerson} hint={f.responsibleHint} optional>
        <Input
          id={id("responsiblePerson")}
          name="responsiblePerson"
          maxLength={200}
          defaultValue={value("responsiblePerson", site?.responsiblePerson)}
          aria-describedby={`${id("responsiblePerson")}-hint`}
          aria-invalid={state.fields?.responsiblePerson}
        />
      </Field>
      <Field id={id("description")} label={f.description} optional>
        <Textarea
          id={id("description")}
          name="description"
          maxLength={5000}
          rows={4}
          defaultValue={value("description", site?.description)}
          aria-invalid={state.fields?.description}
        />
      </Field>
      <FormMessage error={state.error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t.app.sites.submitting : site ? t.app.save : t.app.sites.submitCreate}
        </Button>
      </div>
    </form>
  );
}
