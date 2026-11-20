/**
 * Facts about the service operator for the privacy notice and terms.
 *
 * Status (owner decision, 2026-10-03): the KAIDLY operating company does not exist yet, so
 * the operator facts are **TBA** — a PRE-LAUNCH MANUAL item, not a development blocker
 * (docs/RELEASE_CHECKLIST.md). Nothing here is invented. While any field is null, or
 * `approved` is false, both pages are pre-launch drafts: a restrained notice, fact-dependent
 * paragraphs replaced by one "published before launch" sentence, `noindex`, not in the sitemap.
 */
import { COMPANY } from "../company.ts";

export const LEGAL = {
  // Operator facts come from the one company configuration (lib/company.ts).
  operatorName: COMPANY.name,
  registryCode: COMPANY.registryCode,
  address: COMPANY.address,
  privacyEmail: null as string | null, // TBA — final privacy contact
  effectiveDate: null as string | null, // TBA — YYYY-MM-DD the documents take effect
  /** Data-processing region of the PRODUCTION Supabase project, e.g. "EU (Frankfurt)". */
  hostingRegion: "EU (Ireland, eu-west-1)" as string | null, // verified: production project region
  /** Public contact (lib/company.ts). */
  contactEmail: COMPANY.email as string | null,
  /** Vercel Functions region of Production, e.g. "EU (Frankfurt, fra1)". TÄIDAB KENNETH */
  appRegion: null as string | null,
  /** Resend region of the sending account, e.g. "EU (Ireland, eu-west-1)". TÄIDAB KENNETH */
  emailRegion: null as string | null,
  /** Set to true only after the texts have been reviewed and approved. */
  approved: false,
};

export const legalReady = () =>
  LEGAL.approved &&
  [LEGAL.operatorName, LEGAL.registryCode, LEGAL.address, LEGAL.privacyEmail, LEGAL.effectiveDate, LEGAL.hostingRegion, LEGAL.appRegion, LEGAL.emailRegion].every(Boolean);
