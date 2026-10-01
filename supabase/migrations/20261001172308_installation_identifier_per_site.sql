-- Installation identifier (tähis): optional; when present, unique within its site
-- (not across the organisation — two sites may both have a "PJK-1").
--
-- Compared case-insensitively, so "pjk-1" and "PJK-1" can't coexist on one site.
-- Archived installations keep their identifier, so restoring one never collides.

create unique index electrical_installations_site_identifier_key
  on public.electrical_installations (site_id, lower(identifier))
  where identifier is not null;
