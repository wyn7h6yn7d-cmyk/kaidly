// Turns raw activity_history rows into events people can read. Pure and language-free:
// the page translates the result. Only an allowlist of fields is ever described — ids,
// storage paths, internal timestamps and anything security-related never reach the UI
// (token hashes are already stripped when history is written).

export type HistoryArea =
  | "organisation"
  | "members"
  | "invitations"
  | "sites"
  | "installations"
  | "activities"
  | "deficiencies"
  | "documents";

export const AREA_BY_TABLE: Record<string, HistoryArea> = {
  organisations: "organisation",
  organisation_members: "members",
  organisation_invitations: "invitations",
  sites: "sites",
  electrical_installations: "installations",
  scheduled_activities: "activities",
  deficiencies: "deficiencies",
  documents: "documents",
};

export const TABLE_BY_AREA = Object.fromEntries(
  Object.entries(AREA_BY_TABLE).map(([table, area]) => [area, table]),
) as Record<HistoryArea, string>;

/** Fields whose change is worth naming, per area. Everything else is ignored. */
export const DESCRIBED_FIELDS = {
  organisation: ["name", "registry_code"],
  sites: ["name", "address", "description", "responsible_person"],
  installations: [
    "name",
    "identifier",
    "installation_type",
    "location",
    "description",
    "commissioned_on",
    "status",
    "responsible_person",
    "notes",
    "site_id",
  ],
  activities: [
    "title",
    "description",
    "frequency_type",
    "interval_value",
    "interval_unit",
    "next_due_on",
    "responsible_person_name",
    "priority",
  ],
  deficiencies: ["title", "description", "severity", "detected_at", "responsible_person_name", "due_on"],
  documents: ["title", "category"],
} as const;

export type DescribedField = (typeof DESCRIBED_FIELDS)[keyof typeof DESCRIBED_FIELDS][number];

type Data = Record<string, unknown> | null;
export type HistoryRow = { table: string; action: "insert" | "update" | "delete"; old: Data; new: Data };

export type HistoryEvent =
  | { kind: "created" | "archived" | "restored" | "uploaded"; area: HistoryArea; name: string | null }
  | { kind: "changed"; area: HistoryArea; name: string | null; fields: DescribedField[] }
  | { kind: "status"; area: "deficiencies"; name: string | null; from: string; to: string }
  | { kind: "rescheduled"; area: "activities"; name: string | null; from: string | null; to: string | null }
  | { kind: "memberAdded" | "memberRemoved"; area: "members"; userId: string | null; role: string }
  | { kind: "roleChanged"; area: "members"; userId: string | null; from: string; to: string }
  | { kind: "invited" | "invitationRevoked" | "invitationAccepted"; area: "invitations"; email: string; role: string };

const str = (data: Data, key: string): string | null => {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
};

function nameOf(data: Data): string | null {
  return str(data, "name") ?? str(data, "title");
}

function changedFields(area: HistoryArea, old: Data, next: Data): DescribedField[] {
  const fields = (DESCRIBED_FIELDS as Record<string, readonly DescribedField[]>)[area] ?? [];
  return fields.filter((field) => JSON.stringify(old?.[field] ?? null) !== JSON.stringify(next?.[field] ?? null));
}

/** A readable event for one history row, or null when the row is internal bookkeeping. */
export function describeHistory(row: HistoryRow): HistoryEvent | null {
  const area = AREA_BY_TABLE[row.table];
  if (!area) return null;
  const { old, new: next } = row;

  if (area === "members") {
    const userId = str(next ?? old, "user_id");
    if (row.action === "insert") return { kind: "memberAdded", area, userId, role: str(next, "role") ?? "" };
    if (row.action === "delete") return { kind: "memberRemoved", area, userId, role: str(old, "role") ?? "" };
    const from = str(old, "role");
    const to = str(next, "role");
    return from && to && from !== to ? { kind: "roleChanged", area, userId, from, to } : null;
  }

  if (area === "invitations") {
    const email = str(next ?? old, "email") ?? "";
    const role = str(next ?? old, "role") ?? "";
    if (row.action === "insert") return { kind: "invited", area, email, role };
    if (!str(old, "revoked_at") && str(next, "revoked_at")) return { kind: "invitationRevoked", area, email, role };
    if (!str(old, "accepted_at") && str(next, "accepted_at")) return { kind: "invitationAccepted", area, email, role };
    return null;
  }

  if (area === "documents") {
    // Upload bookkeeping (pending rows, failed-upload cleanup) is not history.
    if (row.action !== "update") return null;
    if (str(old, "status") !== "ready" && str(next, "status") === "ready") {
      return { kind: "uploaded", area, name: nameOf(next) };
    }
  }

  if (row.action === "insert") return { kind: "created", area, name: nameOf(next) };
  if (row.action === "delete") return null;

  const name = nameOf(next) ?? nameOf(old);
  if (!str(old, "archived_at") && str(next, "archived_at")) return { kind: "archived", area, name };
  if (str(old, "archived_at") && !str(next, "archived_at")) return { kind: "restored", area, name };

  if (area === "deficiencies") {
    const from = str(old, "status");
    const to = str(next, "status");
    if (from && to && from !== to) return { kind: "status", area, name, from, to };
  }

  const fields = changedFields(area, old, next);
  if (area === "activities" && fields.length === 1 && fields[0] === "next_due_on") {
    return { kind: "rescheduled", area, name, from: str(old, "next_due_on"), to: str(next, "next_due_on") };
  }
  return fields.length ? { kind: "changed", area, name, fields } : null;
}

/** Where the record lives in the app, if it has its own page. */
export function historyHref(orgSlug: string, table: string, recordId: string): string | null {
  switch (AREA_BY_TABLE[table]) {
    case "organisation":
      return `/o/${orgSlug}/seaded`;
    case "members":
    case "invitations":
      return `/o/${orgSlug}/seaded/liikmed`;
    case "sites":
      return `/o/${orgSlug}/objektid/${recordId}`;
    case "installations":
      return `/o/${orgSlug}/paigaldised/${recordId}`;
    case "activities":
      return `/o/${orgSlug}/kaidukava/${recordId}`;
    case "deficiencies":
      return `/o/${orgSlug}/puudused/${recordId}`;
    case "documents":
      return `/o/${orgSlug}/dokumendid/${recordId}`;
    default:
      return null;
  }
}
