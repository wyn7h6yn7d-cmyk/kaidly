"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorCode } from "@/lib/db/errors";
import { IMPORT_COLUMNS, IMPORT_KINDS, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, validateRows } from "@/lib/import/csv";
import { field } from "@/lib/validation/common";
import { actionContext } from "./context";
import { type ActionState, failure } from "./state";

export type ImportResult = { created: number; repeated: boolean; token: string; row?: number };

const schema = z.object({
  kind: z.enum(IMPORT_KINDS),
  token: z.uuid(),
  rows: z.string().min(2).max(IMPORT_MAX_BYTES * 2),
});

/**
 * Commits reviewed CSV rows through `import_company_data` (owner/admin, writable company,
 * all rows or none, idempotent per token). The rows are validated again here and in the
 * database; the organisation comes from the slug through RLS, never from the client.
 */
export async function importCompanyData(_prev: ActionState<ImportResult>, formData: FormData): Promise<ActionState<ImportResult>> {
  const access = await actionContext(formData, "admin");
  if (!access.ok) return access.error;
  const { ctx } = access;
  const parsed = schema.safeParse({ kind: field(formData, "kind"), token: field(formData, "token"), rows: field(formData, "rows") });
  if (!parsed.success) return failure("invalid_input");
  const { kind, token } = parsed.data;

  let input: unknown;
  try {
    input = JSON.parse(parsed.data.rows);
  } catch {
    return failure("invalid_input");
  }
  if (!Array.isArray(input) || input.length === 0) return failure("import_empty");
  if (input.length > IMPORT_MAX_ROWS) return failure("import_too_many_rows");
  const keys = IMPORT_COLUMNS[kind].map((c) => c.key);
  const rows = input.map((row: unknown, index) => ({
    line: index + 1,
    values: Object.fromEntries(
      keys.map((key) => {
        const value = row && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined;
        return [key, typeof value === "string" ? value : ""];
      }),
    ),
  }));
  const checked = validateRows(kind, rows);
  const firstBad = checked.find((r) => r.issues.length > 0);
  if (firstBad) return { ok: false, errorCode: firstBad.issues[0], data: { created: 0, repeated: false, token, row: firstBad.line } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_company_data", {
    p_org: ctx.org.id,
    p_kind: kind,
    p_rows: checked.map((r) => r.values),
    p_token: token,
  });
  if (error) {
    const row = Number.parseInt(typeof error.details === "string" ? error.details : "", 10);
    return { ok: false, errorCode: dbErrorCode(error), data: { created: 0, repeated: false, token, row: Number.isFinite(row) ? row : undefined } };
  }
  const result = data as { created: number; repeated: boolean };
  return { ok: true, data: { created: result.created, repeated: result.repeated, token } };
}
