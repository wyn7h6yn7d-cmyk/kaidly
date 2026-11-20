import "server-only";
import type { T } from "@/lib/i18n";
import { renderPdf } from "./pdf-document";
import type { Report } from "./types";

/** Report PDF (A4, KAIDLY header/footer). Server only; the document itself: ./pdf-document.ts. */
export function reportPdf(report: Report, t: T): Promise<Buffer> {
  return renderPdf(report, t);
}
