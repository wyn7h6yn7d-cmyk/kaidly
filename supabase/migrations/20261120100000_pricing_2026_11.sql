-- KAIDLY pricing 2026-11 (owner decision 2026-11-20, docs/SUBSCRIPTIONS.md).
--
-- * New fixed-plan catalogue (EUR per month, VAT excluded). The annual price (10 × monthly,
--   invoiced) is display-only and lives in lib/plans.ts; the database enforces limits.
-- * Trial limits for companies created from now on: 1 user, 10 active installations
--   (was 5). 14 days, every feature — unchanged.
-- * Existing companies are NOT changed: limits and prices already copied to
--   private.organisation_access stay as they are until a platform admin assigns a plan.
--   (Owner: all existing companies are test accounts; no migration logic wanted.)
-- * The user-count rule is unchanged: every member incl. the owner + pending invitations;
--   archived installations do not count.
--
-- Rollback (if ever needed): a new migration restoring the previous rows
--   ('start', 19, 1, 5), ('team', 29, 3, 10), ('pro', 39, 5, 25), ('business', 89, 15, 100)
-- and the trial value 5 in private.organisation_access_on_create().

-- ---------------------------------------------------------------------------
-- Catalogue — tests/unit/plans.test.ts parses this VALUES list against lib/plans.ts
-- ---------------------------------------------------------------------------

update private.subscription_plans p
   set monthly_price = v.monthly_price,
       user_limit = v.user_limit,
       installation_limit = v.installation_limit
  from (values
    ('start', 19, 1, 10),
    ('team', 49, 3, 40),
    ('pro', 99, 8, 120),
    ('business', 199, 20, 300)
  ) as v (plan, monthly_price, user_limit, installation_limit)
 where p.plan = v.plan;

do $$
begin
  if (select count(*) from private.subscription_plans) <> 4 then
    raise exception 'pricing_2026_11: expected exactly 4 fixed plans';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Trial limits for new companies: 1 user, 10 active installations
-- ---------------------------------------------------------------------------

-- Same as in 20261007100000_subscription_plans.sql except the installation limit (5 → 10).
create or replace function private.organisation_access_on_create()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_trial private.user_trials;
begin
  if v_user is null then
    insert into private.organisation_access (organisation_id, trial_started_at, trial_ends_at)
    values (new.id, now(), now() + interval '14 days')
    on conflict (organisation_id) do nothing;
    return null;
  end if;

  insert into private.user_trials (user_id, started_at, ends_at, first_organisation_id)
  values (v_user, now(), now() + interval '14 days', new.id)
  on conflict (user_id) do nothing;
  select * into v_trial from private.user_trials where user_id = v_user for update;

  insert into private.organisation_access (organisation_id, trial_started_at, trial_ends_at, user_limit, installation_limit)
  values (new.id, v_trial.started_at, v_trial.ends_at, 1, 10)
  on conflict (organisation_id) do nothing;
  return null;
end;
$$;
