"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { useFieldId } from "@/components/forms/use-field-id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { UploadTarget } from "@/lib/actions/documents";
import { titleFromFilename, UPLOAD_CATEGORIES, type UploadCategory } from "@/lib/documents/rules";
import { AttachmentPicker } from "./attachment-picker";
import { useUploadQueue } from "./use-upload-queue";
import { useT } from "@/lib/i18n/client";

type Choice = { id: string; label: string };

function parseScope(value: string): UploadTarget | null {
  if (value === "org") return { kind: "organisation" };
  const [kind, id] = value.split(":");
  if (kind === "site" && id) return { kind: "site", id };
  if (kind === "inst" && id) return { kind: "installation", id };
  return null;
}

/**
 * A general document (organisation, site or installation). Admins choose any scope;
 * operators only installations (the database enforces the same rule). The file goes
 * straight to Storage; typed values stay if anything fails.
 */
export function DocumentUploadForm({
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
  const router = useRouter();
  const id = useFieldId();
  const copy = t.app.documents;
  const queue = useUploadQueue({ orgSlug });
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [category, setCategory] = useState<UploadCategory>("other");
  const [scope, setScope] = useState(defaultScope);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const file = queue.items.at(-1);
  // Suggest a title from the chosen file until the user types their own.
  const shownTitle = titleTouched || !file ? title : titleFromFilename(file.name);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const target = parseScope(scope);
    if (!file || !target || !shownTitle.trim()) {
      setError(t.errors.invalid_input);
      return;
    }
    setSubmitting(true);
    const ok = await queue.uploadAll(target, category, shownTitle.trim());
    setSubmitting(false);
    if (ok) {
      router.push(
        target.kind === "installation"
          ? `/o/${orgSlug}/paigaldised/${target.id}/dokumendid?salvestatud=1`
          : `/o/${orgSlug}/dokumendid?salvestatud=1`,
      );
    }
    else setError(queue.items.find((item) => item.status === "failed")?.error ?? t.app.attachments.failed);
  }

  return (
    <form method="post" onSubmit={submit} className="flex max-w-2xl flex-col gap-5" noValidate>
      <div>
        <p className="mb-2 text-[15px] font-semibold">{copy.fields.file}</p>
        <AttachmentPicker
          queue={{
            ...queue,
            // One file per document: choosing again replaces the choice.
            add: async (files) => {
              queue.clear();
              await queue.add(files);
            },
          }}
          label={copy.chooseFile}
          hint={copy.fields.fileHint}
          multiple={false}
          disabled={submitting}
        />
      </div>

      <Field id={id("title")} label={copy.fields.title}>
        <Input
          id={id("title")}
          name="title"
          required
          maxLength={200}
          value={shownTitle}
          onChange={(event) => {
            setTitleTouched(true);
            setTitle(event.target.value);
          }}
        />
      </Field>

      <Field id={id("category")} label={copy.fields.category}>
        <Select
          id={id("category")}
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value as UploadCategory)}
        >
          {UPLOAD_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {copy.categories[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id={id("scope")}
        label={copy.fields.scope}
        hint={canUseGeneralScopes ? undefined : copy.adminOnlyScope}
      >
        <Select
          id={id("scope")}
          name="scope"
          required
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          aria-describedby={canUseGeneralScopes ? undefined : `${id("scope")}-hint`}
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

      <FormMessage error={error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="ghost" size="lg">
          <Link href={cancelHref}>{t.app.cancel}</Link>
        </Button>
        <Button type="submit" size="lg" disabled={submitting || queue.busy} className="sm:min-w-[224px]">
          {submitting ? t.app.saving : copy.uploadSubmit}
        </Button>
      </div>
    </form>
  );
}
