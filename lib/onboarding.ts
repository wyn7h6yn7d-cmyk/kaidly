// First-use checklist, derived from real data — no stored progress. Pure, so it can be
// unit-tested; the page supplies the counts (lib/data/onboarding.ts) and the user's role.

export type OnboardingCounts = {
  sites: number;
  installations: number;
  entries: number;
  activities: number;
  documents: number;
};

export type OnboardingStepKey = "organisation" | "site" | "installation" | "entry" | "activity" | "document";

export type OnboardingStep = {
  key: OnboardingStepKey;
  done: boolean;
  /** Where to do it, if this user can do it now. */
  href: string | null;
  /** Why it can't be done yet: a missing earlier step, or a role that doesn't allow it. */
  blockedBy: "site" | "installation" | "role" | null;
};

type Role = "owner" | "admin" | "operator" | "viewer";
const RANK: Record<Role, number> = { viewer: 1, operator: 2, admin: 3, owner: 4 };

export function onboardingSteps(
  counts: OnboardingCounts,
  context: { orgSlug: string; role: Role; firstSiteId: string | null; firstInstallationId: string | null },
): OnboardingStep[] {
  const base = `/o/${context.orgSlug}`;
  const can = (min: Role) => RANK[context.role] >= RANK[min];
  const step = (
    key: OnboardingStepKey,
    done: boolean,
    min: Role,
    needs: "site" | "installation" | null,
    href: string,
  ): OnboardingStep => {
    const missing =
      needs === "site" && counts.sites === 0
        ? "site"
        : needs === "installation" && counts.installations === 0
          ? counts.sites === 0
            ? "site"
            : "installation"
          : null;
    const blockedBy = done ? null : (missing ?? (can(min) ? null : "role"));
    return { key, done, href: done || blockedBy ? null : href, blockedBy };
  };

  return [
    { key: "organisation", done: true, href: null, blockedBy: null },
    step("site", counts.sites > 0, "admin", null, `${base}/objektid/uus`),
    step(
      "installation",
      counts.installations > 0,
      "admin",
      "site",
      `${base}/paigaldised/uus${context.firstSiteId ? `?objekt=${context.firstSiteId}` : ""}`,
    ),
    step("entry", counts.entries > 0, "operator", "installation", `${base}/sissekanne`),
    step(
      "activity",
      counts.activities > 0,
      "admin",
      "installation",
      `${base}/kaidukava/uus${context.firstInstallationId ? `?paigaldis=${context.firstInstallationId}` : ""}`,
    ),
    // Operators add installation documents; admins can also add organisation documents.
    step(
      "document",
      counts.documents > 0,
      "operator",
      can("admin") ? null : "installation",
      `${base}/dokumendid/uus${!can("admin") && context.firstInstallationId ? `?paigaldis=${context.firstInstallationId}` : ""}`,
    ),
  ];
}

export function onboardingComplete(steps: OnboardingStep[]): boolean {
  return steps.every((step) => step.done);
}

/** Cookie remembering that this browser hid the checklist for one organisation (UI only). */
export const guideHiddenCookie = (organisationId: string) => `kaidly_guide_hidden_${organisationId}`;
