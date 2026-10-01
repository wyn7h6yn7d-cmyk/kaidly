/** "Site — PJK-1 Peajaotuskilp" */
export function installationLabel(i: { siteName: string; identifier: string | null; name: string }) {
  return `${i.siteName} — ${i.identifier ? `${i.identifier} ` : ""}${i.name}`;
}
