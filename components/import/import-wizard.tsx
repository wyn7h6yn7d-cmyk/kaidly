"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { FormMessage } from "@/components/forms/form-message";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { importCompanyData, type ImportResult } from "@/lib/actions/import";
import { IMPORT_COLUMNS, INSTALLATION_TYPES, parseImportFile, type ImportKind, type ParsedImport } from "@/lib/import/csv";
import { useT } from "@/lib/i18n/client";

const TEMPLATES: Record<ImportKind, string> = {
  sites: "/templates/kaidly-objektid.csv",
  installations: "/templates/kaidly-elektripaigaldised.csv",
};

/**
 * CSV import: choose type → upload → preview with row validation → confirm (all rows or
 * none) → result. Parsing happens in the browser; the server and database validate again.
 * One random token per parsed file makes a repeated submit harmless.
 */
export function ImportWizard({ orgSlug, writable }: { orgSlug: string; writable: boolean }) {
  const t = useT();
  const copy = t.app.dataImport;
  const id = useId();
  const [kind, setKind] = useState<ImportKind>("sites");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [fileName, setFileName] = useState("");
  const [token, setToken] = useState("");
  const [state, formAction, pending] = useFormAction<ImportResult>(importCompanyData);
  const done = state.ok === true && token !== "" && state.data?.token === token;

  function reset(nextKind: ImportKind = kind) {
    setKind(nextKind);
    setParsed(null);
    setFileName("");
    setToken("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return reset();
    setFileName(file.name);
    const result = parseImportFile(kind, new Uint8Array(await file.arrayBuffer()));
    setParsed(result);
    setToken(crypto.randomUUID());
  }

  const rows = parsed?.ok ? parsed.rows : [];
  const invalid = rows.filter((r) => r.issues.length > 0).length;
  const columns = IMPORT_COLUMNS[kind];
  const previewKeys = columns.slice(0, kind === "sites" ? 2 : 3).map((c) => c.key);

  if (done && state.data) {
    return (
      <section aria-labelledby={`${id}-done`} className="max-w-2xl border-l-4 border-k-green bg-k-surface px-4 py-4 sm:px-5">
        <div role="status">
          <h2 id={`${id}-done`} className="font-bold">
            {copy.success(state.data.created)}
          </h2>
          {state.data.repeated && <p className="mt-1 text-k-muted">{copy.repeated}</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/o/${orgSlug}/objektid`}>{copy.viewSites}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => reset(kind === "sites" ? "installations" : "sites")}>
            {copy.another}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8">
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-bold">{copy.step1}</legend>
        <div className="flex flex-wrap gap-2">
          {(["sites", "installations"] as const).map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-2 border border-k-line bg-k-surface px-4 has-[:checked]:border-k-green has-[:checked]:bg-k-paper-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-k-green"
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={option}
                checked={kind === option}
                onChange={() => reset(option)}
                className="size-4 accent-[hsl(var(--k-green))]"
              />
              <span className="font-semibold">{copy.kinds[option]}</span>
            </label>
          ))}
        </div>
        <p className="text-sm text-k-muted">{copy.kindHints[kind]}</p>
        <details className="border border-k-line bg-k-surface px-4 py-3">
          <summary className="cursor-pointer font-semibold">{copy.columnsTitle}</summary>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
            {columns.map((column) => (
              <div key={column.key} className="contents">
                <dt className="font-mono font-semibold">
                  {column.key}
                  {column.required && <span className="ml-2 font-sans text-xs font-normal text-k-muted">({copy.required})</span>}
                </dt>
                <dd className="text-k-muted">{copy.columns[column.key as keyof typeof copy.columns]}</dd>
              </div>
            ))}
          </dl>
          {kind === "installations" && (
            <>
              <p className="mt-4 text-sm font-semibold">{copy.typesTitle}</p>
              <ul className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                {INSTALLATION_TYPES.map((type) => (
                  <li key={type}>
                    <span className="font-mono font-semibold">{type}</span>{" "}
                    <span className="text-k-muted">— {t.app.installations.types[type]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
        <p>
          <a
            href={TEMPLATES[kind]}
            download
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-k-green underline underline-offset-4"
          >
            <Download className="size-4" aria-hidden="true" />
            {copy.template}: {copy.kinds[kind]}
          </a>
        </p>
      </fieldset>

      <div className="grid gap-2">
        <h2 className="text-lg font-bold">{copy.step2}</h2>
        <label htmlFor={`${id}-file`} className="font-semibold">
          {copy.file}
        </label>
        <input
          key={kind}
          id={`${id}-file`}
          type="file"
          accept=".csv,text/csv"
          aria-describedby={`${id}-file-hint`}
          onChange={(event) => void onFile(event.target.files?.[0])}
          className="block w-full max-w-md text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:border file:border-k-line file:bg-k-surface file:px-4 file:font-semibold"
        />
        <p id={`${id}-file-hint`} className="text-sm text-k-muted">
          {copy.fileHint}
        </p>
        {parsed && !parsed.ok && (
          <FormMessage error={`${fileName}: ${t.errors[parsed.error]}${parsed.detail ? ` (${parsed.detail})` : ""}`} />
        )}
      </div>

      {parsed?.ok && (
        <section aria-labelledby={`${id}-review`} className="grid gap-4">
          <h2 id={`${id}-review`} className="text-lg font-bold">
            {copy.step3}
          </h2>
          <p role="status" className="font-semibold">
            <FileUp className="mr-2 inline size-4" aria-hidden="true" />
            {fileName} — {copy.summary(rows.length - invalid, invalid)}
          </p>
          {parsed.unknownColumns.length > 0 && (
            <p className="text-sm text-k-muted">{copy.unknownColumns(parsed.unknownColumns.join(", "))}</p>
          )}
          <div className="max-h-[28rem] overflow-auto border border-k-line bg-k-surface" tabIndex={0} aria-labelledby={`${id}-caption`}>
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <caption id={`${id}-caption`} className="sr-only">
                {copy.previewCaption}
              </caption>
              <thead className="sticky top-0 bg-k-paper-2">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {copy.row}
                  </th>
                  {previewKeys.map((key) => (
                    <th key={key} scope="col" className="px-3 py-2 font-mono font-semibold">
                      {key}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {copy.status}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-k-line">
                {rows.map((row) => (
                  <tr key={row.line} className={row.issues.length > 0 ? "bg-k-danger/5" : undefined}>
                    <td className="px-3 py-2 tabular-nums">{row.line}</td>
                    {previewKeys.map((key) => (
                      <td key={key} className="max-w-[16rem] px-3 py-2 [overflow-wrap:anywhere]">
                        {row.values[key]}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.issues.length === 0 ? (
                        <span className="font-semibold text-k-green">{copy.ok}</span>
                      ) : (
                        <ul className="grid gap-1 text-k-danger">
                          {row.issues.map((issue) => (
                            <li key={issue}>{t.errors[issue]}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!writable ? (
            <FormMessage error={copy.readOnly} />
          ) : invalid > 0 ? (
            <FormMessage error={`${t.errors.import_has_errors} ${copy.fixFirst}`} />
          ) : (
            <form action={formAction} className="grid gap-3">
              <input type="hidden" name="orgSlug" value={orgSlug} />
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="rows" value={JSON.stringify(rows.map((r) => r.values))} />
              <p className="text-sm text-k-muted">{copy.allOrNothing}</p>
              {state.ok === false && state.errorCode && (!state.data || state.data.token === token) && (
                <div className="grid gap-1">
                  <FormMessage
                    error={`${state.data?.row ? copy.rowError(state.data.row) : ""}${t.errors[state.errorCode]} ${copy.nothingCreated}`}
                  />
                  {state.errorCode === "network" && <p className="text-sm text-k-muted">{copy.retryHint}</p>}
                </div>
              )}
              <div>
                <Button type="submit" size="lg" disabled={pending}>
                  {pending ? copy.importing : copy.confirm(rows.length)}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
