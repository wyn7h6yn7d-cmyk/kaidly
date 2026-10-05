// Plain domain constants shared by client forms and server validation. No zod here:
// client components import from this module so the validation library stays server-side.

// log.ts
export const LOG_ENTRY_TYPES = [
  "inspection",
  "maintenance",
  "switching",
  "fault",
  "repair",
  "measurement",
  "other",
] as const;
export type LogEntryType = (typeof LOG_ENTRY_TYPES)[number];

// schedule.ts
export const FREQUENCIES = ["once", "recurring"] as const;
export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];
export type Priority = (typeof PRIORITIES)[number];
/** Reminder thresholds offered as checkboxes; any other 0–365 can be added as "custom". */
export const REMINDER_PRESETS = [30, 14, 7, 1] as const;
export const DEFAULT_REMINDER_DAYS = [14];

// deficiencies.ts
export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export const DEFICIENCY_STATUSES = ["open", "in_progress", "resolved"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type DeficiencyStatus = (typeof DEFICIENCY_STATUSES)[number];

// sites.ts
export const INSTALLATION_TYPES = [
  "building",
  "switchboard",
  "substation",
  "solar",
  "storage",
  "charging",
  "industrial",
  "other",
] as const;
export type InstallationType = (typeof INSTALLATION_TYPES)[number];
export const INSTALLATION_STATUSES = ["in_service", "out_of_service"] as const;
export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

// account.ts
export const MIN_PASSWORD_LENGTH = 10;
