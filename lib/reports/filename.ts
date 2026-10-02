import type { ReportKind } from "./types.ts";

/** Fixed ASCII names, so file names don't depend on the interface language. */
const NAMES: Record<ReportKind, string> = {
  log: "Kaidupaevik",
  plan: "Kaidukava",
  deficiencies: "Puudused",
  documents: "Dokumendiregister",
  site: "Objekti-kokkuvote",
  installation: "Paigaldise-kokkuvote",
};

/** "Tallinna tehas / PK-01" → "Tallinna-tehas-PK-01"; letters without an ASCII form drop out. */
export function fileSafe(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

/** KAIDLY_Kaidupaevik_Kenneth-OU_2026-10-02.pdf — deterministic, no unsafe characters. */
export function reportFileName(kind: ReportKind, scope: string, fallback: string, day: string, ext: "pdf" | "csv") {
  const part = fileSafe(scope) || fileSafe(fallback) || "KAIDLY";
  return `KAIDLY_${NAMES[kind]}_${part}_${day}.${ext}`;
}
