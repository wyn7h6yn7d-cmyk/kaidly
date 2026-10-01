-- KAIDLY local development seed — fictional demo data.
--
-- Runs automatically on `npm run db:reset` against the LOCAL database only. It is never
-- applied to hosted projects (`supabase db push` does not run seeds). All people,
-- companies and addresses are invented; emails use the reserved .test domain.
--
-- Demo accounts (password for all: kaidly-demo-parool):
--   omanik@kaidly.test     Omanik          (owner)
--   admin@kaidly.test      Administraator  (admin)
--   kaitaja@kaidly.test    Käitaja         (operator)
--   vaataja@kaidly.test    Vaataja         (viewer)
-- Organisation: /o/naidis-elektritood-demo

do $$
declare
  v_org uuid := 'd0000000-0000-4000-8000-00000000d000';
  v_owner uuid := 'd0000000-0000-4000-8000-0000000000a1';
  v_admin uuid := 'd0000000-0000-4000-8000-0000000000a2';
  v_operator uuid := 'd0000000-0000-4000-8000-0000000000a3';
  v_viewer uuid := 'd0000000-0000-4000-8000-0000000000a4';
  v_site1 uuid := 'd0000000-0000-4000-8000-0000000000b1';
  v_site2 uuid := 'd0000000-0000-4000-8000-0000000000b2';
  v_pjk uuid := 'd0000000-0000-4000-8000-0000000000c1';
  v_jk2 uuid := 'd0000000-0000-4000-8000-0000000000c2';
  v_charging uuid := 'd0000000-0000-4000-8000-0000000000c3';
  v_solar uuid := 'd0000000-0000-4000-8000-0000000000c4';
  v_storage uuid := 'd0000000-0000-4000-8000-0000000000c5';
  v_monthly uuid := 'd0000000-0000-4000-8000-0000000000e1';
  v_def_resolved uuid := 'd0000000-0000-4000-8000-0000000000f1';
  v_today date := (now() at time zone 'Europe/Tallinn')::date;
begin
  -- Users (confirmed; the profiles trigger creates their profiles).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
         extensions.crypt('kaidly-demo-parool', extensions.gen_salt('bf')), now(),
         '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.name),
         now(), now(), '', '', '', ''
    from (values
      (v_owner, 'omanik@kaidly.test', 'Olev Omanik'),
      (v_admin, 'admin@kaidly.test', 'Anne Administraator'),
      (v_operator, 'kaitaja@kaidly.test', 'Kati Käitaja'),
      (v_viewer, 'vaataja@kaidly.test', 'Vello Vaataja')) as u(id, email, name);

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, 'email',
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
    from auth.users u where u.id in (v_owner, v_admin, v_operator, v_viewer);

  insert into public.organisations (id, name, slug, registry_code, created_by)
  values (v_org, 'Näidis Elektritööd OÜ', 'naidis-elektritood-demo', '00000000', v_owner);

  insert into public.organisation_members (organisation_id, user_id, role) values
    (v_org, v_owner, 'owner'), (v_org, v_admin, 'admin'),
    (v_org, v_operator, 'operator'), (v_org, v_viewer, 'viewer');

  insert into public.sites (id, organisation_id, name, address, responsible_person, description, created_by) values
    (v_site1, v_org, 'Näidisküla logistikakeskus', 'Näidistee 1, Näidisküla', 'Mati Meister',
     'Ladu ja kontorihoone, 0,4 kV liitumine.', v_admin),
    (v_site2, v_org, 'Näidisküla päikesepark', 'Põllu kinnistu, Näidisküla', 'Mati Meister', null, v_admin);

  insert into public.electrical_installations
    (id, organisation_id, site_id, name, identifier, installation_type, location, commissioned_on, status, responsible_person, created_by)
  values
    (v_pjk, v_org, v_site1, 'Peajaotuskilp', 'PJK-1', 'switchboard', 'Kelder, elektriruum 012', '2018-05-14', 'in_service', 'Mati Meister', v_admin),
    (v_jk2, v_org, v_site1, 'Lao jaotuskilp', 'JK-2', 'switchboard', 'Ladu, telg C/4', '2018-05-14', 'in_service', null, v_admin),
    (v_charging, v_org, v_site1, 'Elektriautode laadijad', 'LA-1', 'charging', 'Parkla', '2023-09-01', 'out_of_service', null, v_admin),
    (v_solar, v_org, v_site2, 'Päikesejaam 1 MW', 'PV-1', 'solar', null, '2022-06-20', 'in_service', 'Mati Meister', v_admin),
    (v_storage, v_org, v_site2, 'Akusalvesti', 'BESS-1', 'storage', 'Konteiner 2', '2024-03-11', 'in_service', null, v_admin);

  -- Operating log (written as the operator).
  insert into public.log_entries
    (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, performed_by_name, created_by)
  values
    (v_org, v_site1, v_pjk, now() - interval '20 days', 'inspection', 'Kilbi visuaalne kontroll, klemmide ülevaatus.', 'Korras', 'Kati Käitaja', v_operator),
    (v_org, v_site1, v_pjk, now() - interval '12 days', 'measurement', 'Isolatsioonitakistuse mõõtmine väljuvatel liinidel.', 'Kõik > 500 MΩ', 'Kati Käitaja', v_operator),
    (v_org, v_site1, v_jk2, now() - interval '6 days', 'fault', 'Rakendus kaitse F7 (valgustus). Põhjus: niiskus valgustis.', null, 'Kati Käitaja', v_operator),
    (v_org, v_site1, v_jk2, now() - interval '5 days', 'repair', 'Valgusti vahetatud, kaitse F7 sisse lülitatud.', 'Töökorras', 'Mati Meister', v_operator),
    (v_org, v_site2, v_solar, now() - interval '2 days', 'switching', 'Inverter 3 välja lülitatud hoolduseks.', null, 'Kati Käitaja', v_operator),
    (v_org, v_site2, v_solar, now() - interval '1 day', 'maintenance', 'Inverter 3 filtrite puhastus, tagasi võrku.', 'Töökorras', 'Kati Käitaja', v_operator);

  -- Operating plan: monthly (with one completion), yearly, an overdue one-time, a done one-time.
  insert into public.scheduled_activities
    (id, organisation_id, site_id, electrical_installation_id, title, frequency_type, interval_value, interval_unit, next_due_on, priority, responsible_person_name, created_by)
  values
    (v_monthly, v_org, v_site1, v_pjk, 'Kilbi visuaalne kontroll', 'recurring', 1, 'month', v_today - 20, 'normal', 'Kati Käitaja', v_admin);
  insert into public.log_entries
    (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, result, created_by, scheduled_activity_id, scheduled_due_on)
  values (v_org, v_site1, v_pjk, now() - interval '19 days', 'inspection', 'Kilbi visuaalne kontroll', 'Korras', v_operator, v_monthly, v_today - 20);
  perform set_config('kaidly.advancing_schedule', 'on', true);
  update public.scheduled_activities
     set next_due_on = private.next_anchored_due(anchor_on, 1, 'month', v_today - 20, v_today)
   where id = v_monthly;
  perform set_config('kaidly.advancing_schedule', 'off', true);

  insert into public.scheduled_activities
    (organisation_id, site_id, electrical_installation_id, title, description, frequency_type, interval_value, interval_unit, next_due_on, priority, created_by)
  values
    (v_org, v_site1, v_pjk, 'Isolatsioonitakistuse mõõtmine', 'Kõik väljuvad liinid.', 'recurring', 3, 'year', v_today + 200, 'high', v_admin),
    (v_org, v_site2, v_solar, 'Paneelide termograafia', null, 'recurring', 1, 'year', v_today + 9, 'normal', v_admin),
    (v_org, v_site1, v_charging, 'Laadijate rikkeotsing', 'Laadija 2 ei käivitu.', 'once', null, null, v_today - 3, 'high', v_admin),
    (v_org, v_site2, v_storage, 'Akusalvesti ventilatsiooni kontroll', null, 'recurring', 6, 'month', v_today + 45, 'low', v_admin);

  -- Deficiencies: open, in progress, resolved (with its log entry).
  insert into public.deficiencies
    (organisation_id, site_id, electrical_installation_id, title, description, severity, due_on, status, responsible_person_name, created_by, detected_at)
  values
    (v_org, v_site1, v_jk2, 'Kilbi uks ei sulgu', 'Lao jaotuskilbi ukse lukk on katki, uks jääb lahti.', 'medium', v_today + 14, 'open', null, v_operator, now() - interval '6 days'),
    (v_org, v_site1, v_charging, 'Laadija 2 rike', 'Laadija 2 ei käivitu, veakood E-04.', 'high', v_today - 2, 'in_progress', 'Mati Meister', v_operator, now() - interval '10 days'),
    (v_org, v_site2, v_solar, 'Kaablikinnitus lahti', 'Rivi 7 kaablikinnitus lahti, kaabel ripub.', 'critical', v_today + 3, 'open', null, v_operator, now() - interval '1 day');

  insert into public.deficiencies
    (id, organisation_id, site_id, electrical_installation_id, title, description, severity, status, resolution,
     resolved_at, resolved_by, resolved_by_name, created_by, detected_at)
  values
    (v_def_resolved, v_org, v_site1, v_pjk, 'Puuduv hoiatussilt', 'Peakilbi uksel puudub pingehoiatuse silt.', 'low', 'resolved',
     'Hoiatussilt paigaldatud.', now() - interval '15 days', v_operator, 'Kati Käitaja', v_operator, now() - interval '20 days');
  insert into public.log_entries
    (organisation_id, site_id, electrical_installation_id, occurred_at, entry_type, description, created_by, deficiency_id)
  values (v_org, v_site1, v_pjk, now() - interval '15 days', 'repair', 'Hoiatussilt paigaldatud.', v_operator, v_def_resolved);
end;
$$;
