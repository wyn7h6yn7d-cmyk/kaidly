-- Phase 2: invitation tokens — hashing, expiry, single use, revocation, email binding,
-- role resolution, cross-tenant RPC access, and no information before validity.

begin;
create extension if not exists pgtap with schema extensions;
\ir helpers/fixture.psql

-- Extra users: one with an unconfirmed email.
insert into test_users (name, id, email) values
  ('unconfirmed', 'e0000000-0000-4000-8000-000000000001', 'unconfirmed@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values (pg_temp.uid('unconfirmed'), 'unconfirmed@example.ee', null, 'authenticated', 'authenticated');

-- Stores a token in a transaction-local setting so later statements can use it.
create function pg_temp.invite(p_key text, p_org text, p_email text, p_role public.org_role)
returns void language plpgsql as $$
declare v_token text;
begin
  select token into v_token
    from public.create_invitation(pg_temp.org(p_org), p_email, p_role);
  perform set_config('test.token_' || p_key, v_token, true);
end;
$$;
create function pg_temp.token(p_key text) returns text
language sql stable as $$ select current_setting('test.token_' || p_key) $$;
grant execute on function pg_temp.invite(text, text, text, public.org_role), pg_temp.token(text)
  to authenticated, anon;

select plan(41);

-- ===========================================================================
-- Creating invitations: who may
-- ===========================================================================

select pg_temp.login('a_admin');
select lives_ok(
  $$ select pg_temp.invite('outsider', 'a', '  Outsider@Example.ee ', 'operator') $$,
  'an admin can invite to their organisation'
);
select matches(
  pg_temp.token('outsider'),
  '^[A-Za-z0-9_-]{43}$',
  'the token is 43 characters of base64url (256 random bits)'
);
select is(
  (select email from public.organisation_invitations where organisation_id = pg_temp.org('a')
    and revoked_at is null),
  'outsider@example.ee',
  'the email is normalised'
);
select throws_ok(
  $$ select * from public.create_invitation(pg_temp.org('a'), 'x@example.ee', 'owner') $$,
  '42501', 'forbidden',
  'an admin cannot invite an owner'
);
select throws_ok(
  $$ select * from public.create_invitation(pg_temp.org('b'), 'x@example.ee', 'viewer') $$,
  '42501', 'forbidden',
  'A admin cannot create invitations for organisation B'
);
select throws_ok(
  $$ select * from public.create_invitation(gen_random_uuid(), 'x@example.ee', 'viewer') $$,
  '42501', 'forbidden',
  'a random organisation id gives the same error (no probing)'
);
select throws_ok(
  $$ select * from public.create_invitation(pg_temp.org('a'), 'a.viewer@example.ee', 'admin') $$,
  'P0001', 'already_member',
  'existing members cannot be invited again'
);
select throws_ok(
  $$ select * from public.create_invitation(pg_temp.org('a'), 'not-an-email', 'viewer') $$,
  '23514', null,
  'an invalid email is rejected'
);

select pg_temp.login('a_operator');
select throws_ok(
  $$ select * from public.create_invitation(pg_temp.org('a'), 'y@example.ee', 'viewer') $$,
  '42501', 'forbidden',
  'an operator cannot invite'
);

select pg_temp.login('a_owner');
select lives_ok(
  $$ select pg_temp.invite('owner2', 'a', 'second.owner@example.ee', 'owner') $$,
  'an owner can invite another owner'
);

select pg_temp.login('b_owner');
select lives_ok(
  $$ select pg_temp.invite('b_invite', 'b', 'outsider@example.ee', 'viewer') $$,
  'organisation B creates its own invitation'
);

-- ===========================================================================
-- Storage of tokens
-- ===========================================================================

reset role;
select is(
  (select count(*)::int from public.organisation_invitations
    where token_hash = sha256(convert_to(pg_temp.token('outsider'), 'UTF8'))),
  1,
  'only the sha256 hash of the token is stored'
);
select is(
  (select count(*)::int from public.organisation_invitations i
    where i::text like '%' || pg_temp.token('outsider') || '%'
       or encode(i.token_hash, 'escape') like '%' || pg_temp.token('outsider') || '%'),
  0,
  'the plaintext token appears nowhere in the invitations table'
);
select is(
  (select count(*)::int from public.activity_history h
    where h.table_name = 'organisation_invitations'
      and (h::text like '%' || pg_temp.token('outsider') || '%'
           or h.new_data ? 'token_hash' or h.old_data ? 'token_hash')),
  0,
  'neither the token nor its hash enters the history'
);

-- ===========================================================================
-- Reading invitations
-- ===========================================================================

select pg_temp.login('a_admin');
select throws_ok(
  $$ select token_hash from public.organisation_invitations $$,
  '42501', null,
  'the token hash cannot be selected'
);
select is_empty(
  $$ select 1 from public.organisation_invitations where organisation_id = pg_temp.org('b') $$,
  'A admin cannot see organisation B invitations'
);
select isnt_empty(
  $$ select 1 from public.organisation_invitations where organisation_id = pg_temp.org('a') $$,
  'an admin sees their organisation''s invitations'
);

select pg_temp.login('a_operator');
select is_empty('select 1 from public.organisation_invitations', 'operators cannot see invitations');

select pg_temp.login('outsider');
select is_empty(
  'select 1 from public.organisation_invitations',
  'invitees cannot list invitations (only the link works)'
);

-- ===========================================================================
-- Preview: nothing before validity
-- ===========================================================================

select pg_temp.login('outsider');
select is(
  public.invitation_preview('not-a-real-token'),
  '{"status": "invalid"}'::jsonb,
  'an unknown token returns only status invalid'
);
select is(
  public.invitation_preview(pg_temp.token('outsider')) - 'expires_at',
  jsonb_build_object('status', 'valid', 'organisation_name', 'Organisatsioon A',
                     'role', 'operator', 'email_matches', true,
                     'already_member', false, 'organisation_slug', null),
  'a valid token shows organisation name and role to the invitee'
);

select pg_temp.login('b_viewer');
select is(
  public.invitation_preview(pg_temp.token('outsider')) ->> 'email_matches',
  'false',
  'preview tells another user the invitation is not for them'
);

-- ===========================================================================
-- Accepting
-- ===========================================================================

select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('outsider')) $$,
  'P0001', 'invitation_email_mismatch',
  'a different user cannot accept someone else''s invitation'
);

select pg_temp.login('outsider');
select is(
  public.accept_invitation(pg_temp.token('outsider')),
  'org-a-test',
  'the invitee accepts and receives the organisation slug'
);
select is(
  (select role::text from public.organisation_members
    where organisation_id = pg_temp.org('a') and user_id = pg_temp.uid('outsider')),
  'operator',
  'organisation and role come from the stored invitation'
);
select results_eq(
  'select id from public.organisations',
  $$ select pg_temp.org('a') $$,
  'accepting A''s invitation grants access to A only'
);
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('outsider')) $$,
  'P0001', 'invitation_used',
  'a token works only once'
);
select is(
  public.invitation_preview(pg_temp.token('outsider')),
  '{"status": "used"}'::jsonb,
  'a used token reveals nothing but its status'
);

-- Expired
select pg_temp.login('a_admin');
select pg_temp.invite('expired', 'a', 'late@example.ee', 'viewer');
reset role;
update public.organisation_invitations
   set created_at = now() - interval '8 days', expires_at = now() - interval '1 day'
 where email = 'late@example.ee';
insert into test_users values ('late', 'e0000000-0000-4000-8000-000000000002', 'late@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values (pg_temp.uid('late'), 'late@example.ee', now(), 'authenticated', 'authenticated');

select pg_temp.login('late');
select is(
  public.invitation_preview(pg_temp.token('expired')),
  '{"status": "expired"}'::jsonb,
  'an expired token reveals nothing but its status'
);
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('expired')) $$,
  'P0001', 'invitation_expired',
  'an expired token cannot be accepted'
);

-- Revoked, and replaced by a newer invitation
select pg_temp.login('a_admin');
select pg_temp.invite('first', 'a', 'twice@example.ee', 'viewer');
select pg_temp.invite('second', 'a', 'twice@example.ee', 'operator');
reset role;
insert into test_users values ('twice', 'e0000000-0000-4000-8000-000000000003', 'twice@example.ee');
insert into auth.users (id, email, email_confirmed_at, aud, role)
values (pg_temp.uid('twice'), 'twice@example.ee', now(), 'authenticated', 'authenticated');

select pg_temp.login('twice');
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('first')) $$,
  'P0001', 'invitation_revoked',
  'a newer invitation revokes the older token'
);

reset role;
select set_config('test.inv_second',
  (select id::text from public.organisation_invitations
    where email = 'twice@example.ee' and revoked_at is null), true);
select set_config('test.inv_owner',
  (select id::text from public.organisation_invitations
    where email = 'second.owner@example.ee'), true);

select pg_temp.login('b_admin');
select throws_ok(
  $$ select public.revoke_invitation(current_setting('test.inv_second')::uuid) $$,
  'P0002', 'not_found',
  'B admin cannot revoke organisation A invitations even with the real id'
);
select throws_ok(
  $$ select public.revoke_invitation(gen_random_uuid()) $$,
  'P0002', 'not_found',
  'an unknown invitation id gives the same error'
);

select pg_temp.login('a_admin');
select throws_ok(
  $$ select public.revoke_invitation(current_setting('test.inv_owner')::uuid) $$,
  'P0002', 'not_found',
  'an admin cannot revoke an owner invitation'
);
select lives_ok(
  $$ select public.revoke_invitation(current_setting('test.inv_second')::uuid) $$,
  'an admin can revoke a pending invitation'
);
select throws_ok(
  $$ select public.revoke_invitation(current_setting('test.inv_second')::uuid) $$,
  'P0002', 'not_found',
  'a revoked invitation cannot be revoked twice'
);

select pg_temp.login('twice');
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('second')) $$,
  'P0001', 'invitation_revoked',
  'a revoked token cannot be accepted'
);

-- Unconfirmed email
select pg_temp.login('a_admin');
select pg_temp.invite('unconfirmed', 'a', 'unconfirmed@example.ee', 'viewer');
select pg_temp.login('unconfirmed');
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('unconfirmed')) $$,
  'P0001', 'email_not_confirmed',
  'an unconfirmed email cannot accept'
);

-- Already a member (joined some other way after the invite was sent)
select pg_temp.login('b_owner');
select pg_temp.invite('multi_b', 'b', 'late@example.ee', 'admin');
reset role;
insert into public.organisation_members (organisation_id, user_id, role)
values (pg_temp.org('b'), pg_temp.uid('late'), 'viewer');
select pg_temp.login('late');
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('multi_b')) $$,
  'P0001', 'invitation_already_member',
  'an existing member cannot use an invitation to change their role'
);

-- Anonymous callers
select pg_temp.logout();
select throws_ok(
  $$ select public.invitation_preview(pg_temp.token('b_invite')) $$,
  '42501', null,
  'anon cannot preview invitations'
);
select throws_ok(
  $$ select public.accept_invitation(pg_temp.token('b_invite')) $$,
  '42501', null,
  'anon cannot accept invitations'
);

select * from finish();
rollback;
