-- KAIDLY: editable company (organisation) settings.
--
-- Owners and admins edit ordinary company metadata; operators and viewers read it.
-- Lifecycle actions stay owner-only (delete/deactivate RPCs). The slug is the stable,
-- non-sequential route identifier and is never client-writable or regenerated on rename
-- (name = mutable display data; slug = stable technical identifier).

alter table public.organisations
  add column contact_email text
    check (contact_email is null or (char_length(contact_email) <= 254 and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  add column contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  add column address text check (address is null or char_length(address) <= 300),
  add column notes text check (notes is null or char_length(notes) <= 2000);

drop policy "owners update organisation settings" on public.organisations;
create policy "admins update organisation settings" on public.organisations
  for update to authenticated
  using (id in (select private.org_ids('admin')))
  with check (id in (select private.org_ids('admin')));

grant update (contact_email, contact_phone, address, notes) on table public.organisations to authenticated;
