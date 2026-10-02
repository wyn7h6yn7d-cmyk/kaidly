-- KAIDLY QA fixtures — LOCAL ONLY. Run through `npm run qa:fixtures` (scripts/qa-fixtures.mjs),
-- which refuses anything that is not the local stack and aborts on the production ref.
-- All companies, people and addresses are fictional; every company name starts with "QA";
-- emails use the reserved .test domain. Password for every QA account: kaidly-qa-parool
--
--   qa-omanik@kaidly.test     owner    QA Elektritööd OÜ
--   qa-kaitaja@kaidly.test    operator QA Elektritööd OÜ
--   qa-vaataja@kaidly.test    viewer   QA Elektritööd OÜ
--   qa-toostus@kaidly.test    owner    QA Tööstuspark OÜ
--   qa-tadmin@kaidly.test     admin    QA Tööstuspark OÜ
--   qa-tkaitaja@kaidly.test   operator QA Tööstuspark OÜ
--   qa-multi@kaidly.test      owner of QA Elektritööd, operator in QA Tööstuspark, viewer in QA Haldus
--   qa-uus@kaidly.test        no company (onboarding)
--   qa-platvorm@kaidly.test   platform admin (no company)
-- Access states: QA Elektritööd = trial (5 days left), QA Tööstuspark = active, QA Haldus OÜ =
-- expired, QA Suletud OÜ = deactivated (with history).

\set ON_ERROR_STOP on

do $$
begin
  if exists (select 1 from public.organisations where slug like 'qa-%') then
    raise exception 'QA fixtures already present — run `npm run db:reset` first (it removes them).';
  end if;
end $$;

create function pg_temp.qa_user(p_email text, p_name text) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_email,
    extensions.crypt('kaidly-qa-parool', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', p_name),
    now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v, v::text, 'email',
    jsonb_build_object('sub', v::text, 'email', p_email, 'email_verified', true), now(), now(), now());
  return v;
end $$;

create function pg_temp.qa_org(p_name text, p_slug text, p_owner uuid) returns uuid
language plpgsql as $$
declare v uuid := gen_random_uuid();
begin
  insert into public.organisations (id, name, slug, registry_code, created_by)
  values (v, p_name, p_slug, null, p_owner);
  insert into public.organisation_members (organisation_id, user_id, role) values (v, p_owner, 'owner');
  return v;
end $$;

do $$
declare
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
  u_owner uuid := pg_temp.qa_user('qa-omanik@kaidly.test', 'Olavi QA-Omanik');
  u_op uuid := pg_temp.qa_user('qa-kaitaja@kaidly.test', 'Kärt QA-Käitaja');
  u_view uuid := pg_temp.qa_user('qa-vaataja@kaidly.test', 'Viktor QA-Vaataja');
  u_t_owner uuid := pg_temp.qa_user('qa-toostus@kaidly.test', 'Tiina QA-Tööstus');
  u_t_admin uuid := pg_temp.qa_user('qa-tadmin@kaidly.test', 'Andres QA-Admin');
  u_t_op uuid := pg_temp.qa_user('qa-tkaitaja@kaidly.test', 'Toomas QA-Käitaja');
  u_multi uuid := pg_temp.qa_user('qa-multi@kaidly.test', 'Mari QA-Mitme');
  u_new uuid := pg_temp.qa_user('qa-uus@kaidly.test', 'Uku QA-Uus');
  u_platform uuid := pg_temp.qa_user('qa-platvorm@kaidly.test', 'Piret QA-Platvorm');
  o_small uuid;
  o_ind uuid;
  o_hald uuid;
  o_closed uuid;
  s1 uuid; s2 uuid;
  i_ids uuid[];
  v_site uuid; v_inst uuid; v_entry uuid; v_def uuid;
  v_types text[] := array['inspection','maintenance','switching','fault','repair','measurement','other'];
  v_itypes text[] := array['switchboard','substation','building','industrial','solar','storage','charging','other'];
  v_sev text[] := array['low','medium','high','critical'];
  n int;
begin
  -- ===== QA Elektritööd OÜ — small contractor, trial ==========================
  o_small := pg_temp.qa_org('QA Elektritööd OÜ', 'qa-elektritood', u_owner);
  insert into public.organisation_members (organisation_id, user_id, role) values
    (o_small, u_op, 'operator'), (o_small, u_view, 'viewer');
  update private.organisation_access
     set trial_started_at = now() - interval '9 days', trial_ends_at = now() + interval '5 days'
   where organisation_id = o_small;

  insert into public.sites (organisation_id, name, address, responsible_person, description, created_by)
  values (o_small, 'QA Kortermaja Kase 4', 'Kase 4, Näidisvalla', 'Olavi QA-Omanik', '24 korterit, 0,4 kV liitumine 3×100 A.', u_owner)
  returning id into s1;
  insert into public.sites (organisation_id, name, address, responsible_person, created_by)
  values (o_small, 'QA Pagaritöökoda', 'Tööstuse 2, Näidislinn', 'Kärt QA-Käitaja', u_owner)
  returning id into s2;

  with ins as (
    insert into public.electrical_installations
      (organisation_id, site_id, name, identifier, installation_type, location, commissioned_on, status, responsible_person, created_by)
    values
      (o_small, s1, 'Peakilp', 'PK-1', 'switchboard', 'Kelder, elektriruum', '2015-04-10', 'in_service', 'Olavi QA-Omanik', u_owner),
      (o_small, s1, 'Trepikoja valgustus', 'TV-1', 'building', 'Trepikojad A ja B', '2015-04-10', 'in_service', null, u_owner),
      (o_small, s1, 'Parkla laadijad', 'LA-1', 'charging', 'Hoovi parkla', '2024-05-02', 'in_service', null, u_owner),
      (o_small, s2, 'Tootmise jaotuskilp', 'JK-T', 'switchboard', 'Tootmisruum', '2019-09-01', 'in_service', 'Kärt QA-Käitaja', u_owner),
      (o_small, s2, 'Ahjude toide', 'AH-1', 'industrial', 'Ahjuruum', '2019-09-01', 'out_of_service', null, u_owner),
      (o_small, s2, 'Päikesepaneelid katusel', 'PV-1', 'solar', 'Katus', '2023-06-15', 'in_service', null, u_owner)
    returning id)
  select array_agg(id) into i_ids from ins;

  -- 24 log entries over 4 months, operator and owner.
  for n in 1..30 loop
    v_inst := i_ids[1 + (n % 6)];
    select site_id into v_site from public.electrical_installations where id = v_inst;
    insert into public.log_entries
      (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, performed_by_name, created_by)
    values (o_small, v_site, v_inst, now() - make_interval(days => 150 - n * 5),
      v_types[1 + (n % 7)]::public.log_entry_type,
      format('QA kanne %s: %s', n, case n % 4 when 0 then 'kilbi visuaalne kontroll ja klemmide pingutus'
        when 1 then 'isolatsioonitakistuse mõõtmine väljuvatel liinidel' when 2 then 'rikke kõrvaldamine, kaitse vahetatud'
        else 'perioodiline hooldus vastavalt käidukavale' end),
      case when n % 3 = 0 then null else 'Korras' end, 'Kärt QA-Käitaja',
      case when n % 2 = 0 then u_op else u_owner end)
    returning id into v_entry;
    -- Corrections on two entries (one with two corrections).
    if n in (6, 12) then
      insert into public.log_entries
        (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by, correction_of_id, correction_reason)
      select organisation_id, site_id, electrical_installation_id, occurred_at, entry_type,
             description || ' (parandatud)', 'Korras, mõõtetulemus parandatud', u_op, id, 'Mõõtetulemus oli valesti sisestatud.'
        from public.log_entries where id = v_entry;
    end if;
    if n = 12 then
      insert into public.log_entries
        (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by, correction_of_id, correction_reason)
      select organisation_id, site_id, electrical_installation_id, occurred_at, entry_type,
             description || ' (teine parandus)', 'Korras', u_owner, id, 'Kuupäev täpsustatud.'
        from public.log_entries where id = v_entry;
    end if;
  end loop;

  -- Plan: reminder thresholds 30/14/7/1/0 days, 1 and 15 days overdue, recurring and once.
  insert into public.scheduled_activities
    (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, responsible_person_name, created_by)
  values
    (o_small, s1, i_ids[1], 'QA Peakilbi termograafia (30 p)', 'recurring', 1, 'year', v_today + 30, 'normal', 'Kärt QA-Käitaja', u_owner),
    (o_small, s1, i_ids[1], 'QA Isolatsioonitakistuse mõõtmine (14 p)', 'recurring', 3, 'year', v_today + 14, 'high', null, u_owner),
    (o_small, s1, i_ids[2], 'QA Avariivalgustuse test (7 p)', 'recurring', 1, 'month', v_today + 7, 'normal', null, u_owner),
    (o_small, s1, i_ids[3], 'QA Laadijate kontroll (1 p)', 'recurring', 6, 'month', v_today + 1, 'low', null, u_owner),
    (o_small, s2, i_ids[4], 'QA Kilbi visuaalne kontroll (täna)', 'recurring', 1, 'week', v_today, 'normal', 'Kärt QA-Käitaja', u_owner),
    (o_small, s2, i_ids[4], 'QA Rikkevoolukaitsmete test (1 p üle)', 'recurring', 3, 'month', v_today - 1, 'high', null, u_owner),
    (o_small, s2, i_ids[5], 'QA Ahjude toite remont (15 p üle)', 'once', null, null, v_today - 15, 'high', null, u_owner),
    (o_small, s1, i_ids[2], 'QA Hoolduse kokkulepe (60 p)', 'once', null, null, v_today + 60, 'low', null, u_owner),
    (o_small, s2, i_ids[6], 'QA Päikesepaneelide puhastus (45 p)', 'recurring', 1, 'year', v_today + 45, 'normal', null, u_owner),
    (o_small, s2, i_ids[6], 'QA Inverteri kontroll (90 p)', 'recurring', 6, 'month', v_today + 90, 'low', null, u_owner);

  -- Deficiencies: every severity and status, overdue and due soon.
  for n in 1..4 loop
    insert into public.deficiencies
      (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, responsible_person_name, created_by, detected_at)
    select o_small, e.site_id, e.id, format('QA Puudus %s', n),
           case n when 1 then 'Kilbi uks ei sulgu, lukk katki.' when 2 then 'Puudub pingehoiatuse silt.'
             when 3 then 'Kaabel kinnitamata, ripub laes.' when 4 then 'Valgusti kate puudu.'
             when 5 then 'Laadija 2 veakood E-04.' else 'Kaitsmete tähistus loetamatu.' end,
           v_sev[1 + (n % 4)]::public.deficiency_severity,
           case n when 1 then v_today - 4 when 2 then v_today + 3 when 3 then v_today + 20 else null end,
           (case when n in (3, 4) then 'in_progress' else 'open' end)::public.deficiency_status,
           case when n = 3 then 'Kärt QA-Käitaja' else null end, u_op, now() - make_interval(days => 30 - n)
      from public.electrical_installations e where e.id = i_ids[1 + (n % 6)];
  end loop;
  insert into public.deficiencies
    (organisation_id, site_id, electrical_installation_id, title, description, severity, status, resolution,
     resolved_at, resolved_by, resolved_by_name, created_by, detected_at)
  values (o_small, s1, i_ids[1], 'QA Lahendatud puudus', 'Klemm ülekuumenenud.', 'high', 'resolved',
     'Klemm vahetatud, termograafia korras.', now() - interval '10 days', u_op, 'Kärt QA-Käitaja', u_op, now() - interval '25 days')
  returning id into v_def;
  insert into public.log_entries
    (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, created_by, deficiency_id)
  values (o_small, s1, i_ids[1], now() - interval '10 days', 'repair', 'Klemm vahetatud, termograafia korras.', u_op, v_def);

  insert into public.documents
    (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, uploaded_by, ready_at)
  select o_small, e.site_id, e.id, c::public.document_category, format('QA %s — %s', e.identifier, c), format('qa-%s-%s.pdf', e.identifier, c),
         'application/pdf', 4096, 'ready', u_owner, now()
    from public.electrical_installations e, unnest(array['single_line_diagram','measurement_protocol']) c
   where e.organisation_id = o_small and e.identifier in ('PK-1', 'JK-T');

  -- ===== QA Tööstuspark OÜ — larger customer, active ===============================
  o_ind := pg_temp.qa_org('QA Tööstuspark OÜ', 'qa-toostuspark', u_t_owner);
  insert into public.organisation_members (organisation_id, user_id, role) values
    (o_ind, u_t_admin, 'admin'), (o_ind, u_t_op, 'operator'), (o_ind, u_multi, 'operator');
  update private.organisation_access
     set full_access_from = now() - interval '30 days', full_access_until = null,
         invoice_reference = 'QA-ARVE-001', activated_by = u_platform
   where organisation_id = o_ind;

  for n in 1..8 loop
    insert into public.sites (organisation_id, name, address, responsible_person, created_by)
    values (o_ind, format('QA Tööstuspark hoone %s', chr(64 + n)), format('Tööstuspargi tee %s, Näidisvald', n * 2),
            case when n % 2 = 0 then 'Andres QA-Admin' else null end, u_t_admin);
  end loop;
  -- 24 installations, 3 per site.
  for v_site in select id from public.sites where organisation_id = o_ind order by name loop
    for n in 1..3 loop
      insert into public.electrical_installations
        (organisation_id, site_id, name, identifier, installation_type, commissioned_on, status, created_by)
      values (o_ind, v_site, (array['Alajaam','Peajaotuskeskus','Tootmisliin'])[n],
              format('%s-%s', (array['AJ','PJK','TL'])[n], substr(v_site::text, 1, 4)),
              v_itypes[1 + ((n * 3 + length(v_site::text)) % 8)]::public.installation_type,
              date '2010-01-01' + (n * 400), 'in_service', u_t_admin);
    end loop;
  end loop;
  select array_agg(id order by name, identifier) into i_ids from public.electrical_installations where organisation_id = o_ind;

  -- 160 log entries.
  for n in 1..160 loop
    v_inst := i_ids[1 + (n % array_length(i_ids, 1))];
    select site_id into v_site from public.electrical_installations where id = v_inst;
    insert into public.log_entries
      (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by)
    values (o_ind, v_site, v_inst, now() - make_interval(hours => n * 30),
      v_types[1 + (n % 7)]::public.log_entry_type, format('QA tööstuse kanne %s — ringkäik ja näitude kontroll', n),
      case when n % 5 = 0 then 'Märkustega' else 'Korras' end,
      case when n % 3 = 0 then u_multi when n % 3 = 1 then u_t_op else u_t_admin end);
  end loop;

  -- 42 activities spread −20 … +100 days.
  for n in 1..42 loop
    v_inst := i_ids[1 + (n % array_length(i_ids, 1))];
    select site_id into v_site from public.electrical_installations where id = v_inst;
    insert into public.scheduled_activities
      (organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, created_by)
    values (o_ind, v_site, v_inst, format('QA Tööstuse tegevus %s', n),
      (case when n % 4 = 0 then 'once' else 'recurring' end)::public.activity_frequency,
      case when n % 4 = 0 then null else 1 + n % 3 end,
      (case when n % 4 = 0 then null else (array['month','year','week'])[1 + n % 3] end)::public.interval_unit,
      v_today - 20 + n * 3, (array['low','normal','high'])[1 + n % 3]::public.activity_priority, u_t_admin);
  end loop;

  -- 20 deficiencies.
  for n in 1..20 loop
    v_inst := i_ids[1 + (n * 2 % array_length(i_ids, 1))];
    select site_id into v_site from public.electrical_installations where id = v_inst;
    insert into public.deficiencies
      (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, created_by, detected_at)
    values (o_ind, v_site, v_inst, format('QA Tööstuse puudus %s', n), 'Leitud ringkäigul, vajab kõrvaldamist.',
      v_sev[1 + (n % 4)]::public.deficiency_severity, case when n % 3 = 0 then null else v_today - 10 + n * 2 end,
      (case when n % 5 = 0 then 'in_progress' else 'open' end)::public.deficiency_status, u_t_op,
      now() - make_interval(days => 40 - n));
  end loop;

  -- Metadata-only documents (no file bytes: listing/search QA; download shows "not found").
  for n in 1..30 loop
    v_inst := i_ids[1 + (n % array_length(i_ids, 1))];
    select site_id into v_site from public.electrical_installations where id = v_inst;
    insert into public.documents
      (organisation_id, site_id, electrical_installation_id, category, title, original_filename, mime_type, size_bytes, status, uploaded_by, ready_at)
    values (o_ind, v_site, v_inst, (array['audit','measurement_protocol','single_line_diagram','manual'])[1 + n % 4]::public.document_category,
      format('QA dokument %s', n), format('qa-dokument-%s.pdf', n), 'application/pdf', 1024 * n, 'ready', u_t_admin, now());
  end loop;

  -- ===== QA Haldus OÜ — expired (multi-company user is a viewer here) ===============
  o_hald := pg_temp.qa_org('QA Haldus OÜ', 'qa-haldus', u_t_owner);
  insert into public.organisation_members (organisation_id, user_id, role) values (o_hald, u_multi, 'viewer');
  insert into public.sites (organisation_id, name, created_by) values (o_hald, 'QA Büroohoone', u_t_owner) returning id into v_site;
  insert into public.electrical_installations (organisation_id, site_id, name, installation_type, status, created_by)
  values (o_hald, v_site, 'Büroo peakilp', 'switchboard', 'in_service', u_t_owner) returning id into v_inst;
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, created_by)
  values (o_hald, v_site, v_inst, now() - interval '40 days', 'inspection', 'QA kontroll enne prooviperioodi lõppu.', u_t_owner);
  update private.organisation_access
     set trial_started_at = now() - interval '30 days', trial_ends_at = now() - interval '16 days'
   where organisation_id = o_hald;

  -- ===== QA Suletud OÜ — deactivated with history ====================================
  o_closed := pg_temp.qa_org('QA Suletud OÜ', 'qa-suletud', u_owner);
  insert into public.sites (organisation_id, name, created_by) values (o_closed, 'QA Endine objekt', u_owner) returning id into v_site;
  insert into public.electrical_installations (organisation_id, site_id, name, installation_type, status, created_by)
  values (o_closed, v_site, 'Endine kilp', 'switchboard', 'out_of_service', u_owner) returning id into v_inst;
  insert into public.log_entries (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, created_by)
  values (o_closed, v_site, v_inst, now() - interval '60 days', 'other', 'QA viimane kanne enne sulgemist.', u_owner);
  update public.organisations set deactivated_at = now() - interval '3 days', deactivated_by = u_owner where id = o_closed;

  -- ===== Multi-company user owns QA Elektritööd =========================================
  insert into public.organisation_members (organisation_id, user_id, role) values (o_small, u_multi, 'owner');

  -- ===== Platform admin (local only) =============================================
  insert into private.platform_admins (user_id) values (u_platform);

  -- Reminders for today (the activity trigger already evaluated each insert).
  perform private.generate_activity_reminders(v_today);
end $$;

select o.name, o.slug,
       (select count(*) from public.sites s where s.organisation_id = o.id) as sites,
       (select count(*) from public.electrical_installations e where e.organisation_id = o.id) as installations,
       (select count(*) from public.log_entries l where l.organisation_id = o.id) as log_entries,
       (select count(*) from public.scheduled_activities a where a.organisation_id = o.id) as activities,
       (select count(*) from public.deficiencies d where d.organisation_id = o.id) as deficiencies,
       (select count(*) from public.notifications n where n.organisation_id = o.id) as reminders
  from public.organisations o where o.slug like 'qa-%' order by o.slug;
