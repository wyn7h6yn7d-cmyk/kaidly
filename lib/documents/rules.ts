// Document register rules shared by the browser and the server. KAIDLY stores no files
// (2026-10-08): a document is a title, category, placement and an external https link.
// Files uploaded before that are still shown (and can be deleted); none are added.

/** Files uploaded earlier that are images get a thumbnail. */
export const IMAGE_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const isImageType = (mime: string | null) => mime !== null && IMAGE_TYPES.includes(mime);

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

/** Categories for new documents: "photo" stays only for files uploaded earlier. */
export const LINK_CATEGORIES = [
  "audit",
  "measurement_protocol",
  "single_line_diagram",
  "operating_plan",
  "maintenance_report",
  "declaration",
  "manual",
  "other",
] as const satisfies readonly DocumentCategory[];

export type LinkCategory = (typeof LINK_CATEGORIES)[number];
