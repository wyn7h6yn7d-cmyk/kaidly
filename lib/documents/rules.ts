// File rules shared by the browser (early feedback) and the server (authoritative before
// registering). The database and the Storage bucket enforce the same type and size limits.

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Allowed types and the extensions each may carry. No SVG, HTML or executables. */
export const ALLOWED_FILE_TYPES = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
} as const satisfies Record<string, readonly string[]>;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

export const IMAGE_TYPES: readonly AllowedMimeType[] = ["image/jpeg", "image/png", "image/webp"];

/** For <input accept>. */
export const ACCEPT_ATTRIBUTE = Object.entries(ALLOWED_FILE_TYPES)
  .flatMap(([mime, extensions]) => [mime, ...extensions.map((e) => `.${e}`)])
  .join(",");

export const DOCUMENT_CATEGORIES = [
  "audit",
  "measurement_protocol",
  "single_line_diagram",
  "operating_plan",
  "maintenance_report",
  "declaration",
  "manual",
  "photo",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export type FileProblem = "type" | "size" | "empty";

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return Object.hasOwn(ALLOWED_FILE_TYPES, value);
}

/** Both the declared type and the extension must be allowed, and must agree. */
export function checkFile(file: { name: string; type: string; size: number }): FileProblem | null {
  const mime = file.type.toLowerCase();
  if (!isAllowedMimeType(mime)) return "type";
  if (!(ALLOWED_FILE_TYPES[mime] as readonly string[]).includes(extensionOf(file.name))) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

/**
 * A display name only — object keys never use it. Strips paths and control characters,
 * collapses whitespace and keeps at most 255 characters with the extension intact.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f:]/g, "").replace(/\s+/g, " ").trim();
  if (!clean || clean === "." || clean === "..") return "file";
  if (clean.length <= 255) return clean;
  const extension = extensionOf(clean);
  const keep = extension ? 255 - extension.length - 1 : 255;
  return extension ? `${clean.slice(0, keep)}.${extension}` : clean.slice(0, 255);
}

/** Title suggestion from a filename: without extension, separators as spaces. */
export function titleFromFilename(name: string): string {
  const clean = sanitizeFilename(name);
  const extension = extensionOf(clean);
  const stem = extension ? clean.slice(0, -(extension.length + 1)) : clean;
  return (stem.replace(/[_]+/g, " ").trim() || clean).slice(0, 200);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
