"use client";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateDocument } from "@/lib/actions/documents";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/documents/rules";
import { useT } from "@/lib/i18n/client";


/** Title and category of a general document (admins). The file itself never changes. */
export function DocumentEditForm({
  orgSlug,
  documentId,
  title,
  category,
}: {
  orgSlug: string;
  documentId: string;
  title: string;
  category: DocumentCategory;
}) {
  const t = useT();
  const [state, action, pending, value] = useFormAction(updateDocument);
  const id = useFieldId();
  const copy = t.app.documents;
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="documentId" value={documentId} />
      <Field id={id("title")} label={copy.fields.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          defaultValue={value("title", title)}
          aria-invalid={state.fields?.title}
        />
      </Field>
      <Field id={id("category")} label={copy.fields.category}>
        <Select
          key={value("category", category)}
          id={id("category")}
          name="category"
          defaultValue={value("category", category)}
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {copy.categories[c]}
            </option>
          ))}
        </Select>
      </Field>
      <FormMessage code={state.errorCode} success={state.ok ? t.app.saved : undefined} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t.app.saving : t.app.save}
        </Button>
      </div>
    </form>
  );
}
