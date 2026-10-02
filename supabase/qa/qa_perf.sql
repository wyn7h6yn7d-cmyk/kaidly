-- KAIDLY QA performance company — LOCAL ONLY (`npm run qa:fixtures -- --perf`).
-- 30 sites, 150 installations, 2000 log entries, 500 activities, 300 deficiencies,
-- 500 metadata-only document rows, ~500 reminders, plus extreme-length texts for layout QA.
-- Owner: qa-toostus@kaidly.test (password kaidly-qa-parool).

do $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  u uuid := (select id from auth.users where email = 'qa-toostus@kaidly.test');
  o uuid := gen_random_uuid();
  inst uuid[];
  sites uuid[];
  n int;
  v_long text := repeat('Väga-pikk-sõna-ilma-tühikuteta-', 6) || ' ' || repeat('Pikk kirjeldus elektripaigaldise kohta. ', 120);
begin
  insert into public.organisations (id, name, slug, created_by)
  values (o, 'QA Jõudlus ja Väga Pika Nimega Elektripaigaldiste Haldusettevõte OÜ', 'qa-joudlus', u);
  insert into public.organisation_members (organisation_id, user_id, role) values (o, u, 'owner');

  insert into public.sites (organisation_id, name, address, created_by)
  select o, format('QA Objekt %s', lpad(g::text, 2, '0')),
         case when g = 1 then repeat('Pikk aadress ', 15) else format('Näidistee %s', g) end, u
    from generate_series(1, 30) g;
  select array_agg(id order by name) into sites from public.sites where organisation_id = o;

  insert into public.electrical_installations (organisation_id, site_id, name, identifier, installation_type, status, created_by)
  select o, sites[1 + (g - 1) / 5],
         case when g = 1 then 'Väga pika nimega peajaotuskeskus koos alamkilpide ja reservtoitega ' || repeat('X', 60)
              else format('QA Paigaldis %s', lpad(g::text, 3, '0')) end,
         format('P-%s', lpad(g::text, 3, '0')),
         (array['switchboard','substation','building','industrial','solar','storage','charging','other'])[1 + g % 8]::public.installation_type,
         'in_service', u
    from generate_series(1, 150) g;
  select array_agg(id order by identifier) into inst from public.electrical_installations where organisation_id = o;

  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by)
  select o, e.site_id, e.id, now() - make_interval(hours => g * 7),
         (array['inspection','maintenance','switching','fault','repair','measurement','other'])[1 + g % 7]::public.log_entry_type,
         case when g = 1 then btrim(left(v_long, 5000)) else format('QA jõudluskanne %s', g) end,
         case when g % 4 = 0 then null else 'Korras' end, u
    from generate_series(1, 2000) g
    join public.electrical_installations e on e.id = inst[1 + g % 150];

  insert into public.scheduled_activities (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, created_by)
  select o, e.site_id, e.id, format('QA jõudlustegevus %s', g), 'recurring', 1 + g % 6,
         (array['week','month','year'])[1 + g % 3]::public.interval_unit,
         v_today - 30 + g % 200, (array['low','normal','high'])[1 + g % 3]::public.activity_priority, u
    from generate_series(1, 500) g
    join public.electrical_installations e on e.id = inst[1 + g % 150];

  insert into public.deficiencies (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, created_by)
  select o, e.site_id, e.id,
         case when g = 1 then left('Väga pikk puuduse pealkiri ' || repeat('ilma-murdmiskohtadeta', 12), 200) else format('QA jõudluspuudus %s', g) end,
         'Jõudlustesti puudus.', (array['low','medium','high','critical'])[1 + g % 4]::public.deficiency_severity,
         case when g % 3 = 0 then null else v_today - 50 + g % 100 end,
         (case when g % 4 = 0 then 'in_progress' else 'open' end)::public.deficiency_status, u
    from generate_series(1, 300) g
    join public.electrical_installations e on e.id = inst[1 + g % 150];

  insert into public.documents (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, uploaded_by, ready_at)
  select o, e.site_id, e.id,
         (array['audit','measurement_protocol','single_line_diagram','operating_plan','maintenance_report','declaration','manual','photo','other'])[1 + g % 9]::public.document_category,
         format('QA jõudlusdokument %s', g), format('qa-%s.pdf', g), 'application/pdf', 2048, 'ready', u, now()
    from generate_series(1, 500) g
    join public.electrical_installations e on e.id = inst[1 + g % 150];
  -- A second member, and reminder history from the last 60 days (as the daily job would have written it).
  insert into public.organisation_members (organisation_id, user_id, role)
  select o, id, 'admin' from auth.users where email = 'qa-tadmin@kaidly.test';
  for n in reverse 60..0 loop
    perform private.generate_activity_reminders(v_today - n);
  end loop;
end $$;

select 'qa-joudlus' as slug,
  (select count(*) from public.sites s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as sites,
  (select count(*) from public.electrical_installations s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as installations,
  (select count(*) from public.log_entries s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as log_entries,
  (select count(*) from public.scheduled_activities s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as activities,
  (select count(*) from public.deficiencies s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as deficiencies,
  (select count(*) from public.documents s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as documents,
  (select count(*) from public.notifications s join public.organisations o on o.id = s.organisation_id where o.slug = 'qa-joudlus') as reminders;
