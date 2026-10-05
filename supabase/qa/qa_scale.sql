-- KAIDLY scale fixture — LOCAL ONLY (`npm run qa:fixtures -- --scale`, after qa_fixtures.sql).
-- Deterministic fictional data for performance/reliability work:
--   100 companies "QA Mastaap NNN OÜ" with 5 members each (500 users/memberships),
--   500 sites, 2,500 installations, 50,000 log entries, 10,000 activities,
--   5,000 deficiencies, 10,000 document metadata rows (no Storage objects),
--   plus one large customer "QA Suurklient OÜ": 100 sites, 1,000 installations,
--   25,000 entries, 5,000 activities, 2,000 deficiencies, 5,000 documents.
-- Notifications come from the real generator (private.generate_activity_reminders).
-- Owner of the large customer and of company 001: qa-suur@kaidly.test (kaidly-qa-parool).

do $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  v_pw text := extensions.crypt('kaidly-qa-parool', extensions.gen_salt('bf', 4));
  big uuid := 'ba000000-0000-4000-8000-000000000001';
  owner_big uuid := 'ba000000-0000-4000-8000-0000000000a1';
begin
  -- Users: 500 company members + the large customer's owner (bcrypt cost 4: fixture speed).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change, email_change_token_new)
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_pw, now(),
         '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.name), now(), now(), '', '', '', ''
    from (select ('5c000000-0000-4000-8000-' || lpad(to_hex(g), 12, '0'))::uuid id,
                 format('qa-mastaap-%s@kaidly.test', g) email, format('Mastaap Kasutaja %s', g) name
            from generate_series(1, 500) g
          union all select owner_big, 'qa-suur@kaidly.test', 'Suur QA-Klient') u;

  -- 100 companies, 5 members each (owner, admin, 2 operators, viewer).
  insert into public.organisations (id, name, slug, created_by)
  select ('5d000000-0000-4000-8000-' || lpad(to_hex(c), 12, '0'))::uuid, format('QA Mastaap %s OÜ', lpad(c::text, 3, '0')),
         format('qa-mastaap-%s', lpad(c::text, 3, '0')), ('5c000000-0000-4000-8000-' || lpad(to_hex((c - 1) * 5 + 1), 12, '0'))::uuid
    from generate_series(1, 100) c;
  insert into public.organisation_members (organisation_id, user_id, role)
  select ('5d000000-0000-4000-8000-' || lpad(to_hex(c), 12, '0'))::uuid,
         ('5c000000-0000-4000-8000-' || lpad(to_hex((c - 1) * 5 + k), 12, '0'))::uuid,
         (array['owner', 'admin', 'operator', 'operator', 'viewer'])[k]::public.org_role
    from generate_series(1, 100) c, generate_series(1, 5) k;
  -- The large customer's owner is also an owner of company 001 (multi-company case).
  insert into public.organisation_members (organisation_id, user_id, role)
  values ('5d000000-0000-4000-8000-000000000001', owner_big, 'owner');

  insert into public.sites (organisation_id, name, address, created_by)
  select o.id, format('Mastaap objekt %s-%s', right(o.slug, 3), s), format('Tööstuse %s, Näidisvald', s), o.created_by
    from public.organisations o, generate_series(1, 5) s where o.slug like 'qa-mastaap-%';
  insert into public.electrical_installations (organisation_id, site_id, name, identifier, installation_type, status, created_by)
  select s.organisation_id, s.id, format('Kilp %s', i), format('K-%s', i),
         (array['switchboard','substation','building','industrial','solar'])[i]::public.installation_type, 'in_service', s.created_by
    from public.sites s join public.organisations o on o.id = s.organisation_id, generate_series(1, 5) i
   where o.slug like 'qa-mastaap-%';

  -- 20 entries, 4 activities, 2 deficiencies, 4 documents per installation (2,500 installations).
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by)
  select e.organisation_id, e.site_id, e.id, now() - make_interval(days => n * 9, hours => (hashtext(e.id::text) & 15)),
         (array['inspection','maintenance','switching','fault','repair','measurement','other'])[1 + n % 7]::public.log_entry_type,
         format('Mastaap kanne %s: kontroll ja mõõtmine', n), case when n % 3 = 0 then null else 'Korras' end, e.created_by
    from public.electrical_installations e join public.organisations o on o.id = e.organisation_id, generate_series(1, 20) n
   where o.slug like 'qa-mastaap-%';
  insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, created_by)
  select e.organisation_id, e.site_id, e.id, format('Mastaap tegevus %s', n), 'recurring', 1 + n % 3,
         (array['month','year','week'])[1 + n % 3]::public.interval_unit, v_today - 20 + ((hashtext(e.id::text || n) & 255) % 120),
         'normal', e.created_by
    from public.electrical_installations e join public.organisations o on o.id = e.organisation_id, generate_series(1, 4) n
   where o.slug like 'qa-mastaap-%';
  insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, created_by)
  select e.organisation_id, e.site_id, e.id, format('Mastaap puudus %s', n), 'Leitud kontrollil.',
         (array['low','medium','high','critical'])[1 + (hashtext(e.id::text || n) & 3)]::public.deficiency_severity,
         v_today + ((hashtext(e.id::text) & 63) - 20), 'open', e.created_by
    from public.electrical_installations e join public.organisations o on o.id = e.organisation_id, generate_series(1, 2) n
   where o.slug like 'qa-mastaap-%';
  insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, uploaded_by, ready_at)
  select e.organisation_id, e.site_id, e.id, (array['audit','measurement_protocol','single_line_diagram','manual'])[n]::public.document_category,
         format('Mastaap dokument %s', n), format('mastaap-%s.pdf', n), 'application/pdf', 4096, 'ready', e.created_by, now()
    from public.electrical_installations e join public.organisations o on o.id = e.organisation_id, generate_series(1, 4) n
   where o.slug like 'qa-mastaap-%';

  -- The large customer.
  insert into public.organisations (id, name, slug, created_by) values (big, 'QA Suurklient OÜ', 'qa-suurklient', owner_big);
  insert into public.organisation_members (organisation_id, user_id, role) values (big, owner_big, 'owner');
  insert into public.sites (organisation_id, name, address, created_by)
  select big, format('Suurkliendi objekt %s', lpad(s::text, 3, '0')), format('Tehase tee %s', s), owner_big from generate_series(1, 100) s;
  insert into public.electrical_installations (organisation_id, site_id, name, identifier, installation_type, status, created_by)
  select big, s.id, format('Paigaldis %s', i), format('P-%s', i),
         (array['switchboard','substation','building','industrial','solar','storage','charging','other'])[1 + i % 8]::public.installation_type, 'in_service', owner_big
    from public.sites s, generate_series(1, 10) i where s.organisation_id = big;
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by)
  select big, e.site_id, e.id, now() - make_interval(hours => n * 140 + (hashtext(e.id::text) & 127)),
         (array['inspection','maintenance','switching','fault','repair','measurement','other'])[1 + n % 7]::public.log_entry_type,
         format('Suurkliendi kanne %s: ringkäik, kontroll ja mõõtmine', n), 'Korras', owner_big
    from public.electrical_installations e, generate_series(1, 25) n where e.organisation_id = big;
  insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, created_by)
  select big, e.site_id, e.id, format('Suurkliendi tegevus %s', n), 'recurring', 1 + n % 6,
         (array['week','month','year'])[1 + n % 3]::public.interval_unit, v_today - 30 + ((hashtext(e.id::text || n) & 255) % 200), 'normal', owner_big
    from public.electrical_installations e, generate_series(1, 5) n where e.organisation_id = big;
  insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, created_by)
  select big, e.site_id, e.id, format('Suurkliendi puudus %s', n), 'Leitud ringkäigul.',
         (array['low','medium','high','critical'])[1 + (hashtext(e.id::text || n) & 3)]::public.deficiency_severity,
         v_today + ((hashtext(e.id::text || n) & 63) - 30), (array['open','in_progress'])[1 + n % 2]::public.deficiency_status, owner_big
    from public.electrical_installations e, generate_series(1, 2) n where e.organisation_id = big;
  insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, uploaded_by, ready_at)
  select big, e.site_id, e.id, (array['audit','measurement_protocol','single_line_diagram','manual','photo'])[n]::public.document_category,
         format('Suurkliendi dokument %s', n), format('suur-%s.pdf', n), 'application/pdf', 4096, 'ready', owner_big, now()
    from public.electrical_installations e, generate_series(1, 5) n where e.organisation_id = big;
end $$;

-- Reminders the way the daily job writes them (last 30 days, so history exists).
do $$
declare d date := (now() at time zone 'Europe/Tallinn')::date;
begin
  for n in reverse 30..0 loop
    perform private.generate_activity_reminders(d - n);
  end loop;
end $$;

analyze;

select 'companies' k, count(*) from public.organisations where slug like 'qa-mastaap-%' or slug = 'qa-suurklient'
union all select 'users', count(*) from auth.users where email like 'qa-mastaap-%' or email = 'qa-suur@kaidly.test'
union all select 'sites', count(*) from public.sites s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'installations', count(*) from public.electrical_installations s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'log entries', count(*) from public.log_entries s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'activities', count(*) from public.scheduled_activities s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'deficiencies', count(*) from public.deficiencies s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'documents', count(*) from public.documents s join public.organisations o on o.id = s.organisation_id where o.slug like 'qa-mastaap-%' or o.slug = 'qa-suurklient'
union all select 'notifications (all)', count(*) from public.notifications;
