/**
 * Facts about the service operator for the privacy notice and terms. These are NOT known
 * to the codebase and must be supplied by the KAIDLY owner — nothing here is invented.
 * While any field is null, or `approved` is false, the legal pages show a clear
 * "draft — not yet in force" notice and mark each missing field (docs/RELEASE_CHECKLIST.md).
 */
export const LEGAL = {
  operatorName: null as string | null, // service operator's legal name
  registryCode: null as string | null, // Estonian business registry code
  address: null as string | null, // registered address
  privacyEmail: null as string | null, // contact for privacy requests
  effectiveDate: null as string | null, // YYYY-MM-DD the documents take effect
  /** Data-processing region of the PRODUCTION Supabase project, e.g. "EU (Frankfurt)". */
  hostingRegion: null as string | null,
  /** Set to true only after the texts have been reviewed and approved. */
  approved: false,
};

export const legalReady = () =>
  LEGAL.approved && [LEGAL.operatorName, LEGAL.registryCode, LEGAL.address, LEGAL.privacyEmail, LEGAL.effectiveDate, LEGAL.hostingRegion].every(Boolean);
