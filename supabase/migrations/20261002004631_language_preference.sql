-- KAIDLY: the user's preferred UI language (et / en / ru).
--
-- Stored on the user's own profile so it follows them across devices; the app keeps a
-- cookie in step for rendering. Users may change only their own value (existing
-- "users update own profile" policy) and only this column (column grant). Null = not
-- chosen yet (the app then keeps the cookie or the default, Estonian).

alter table public.profiles
  add column preferred_locale text check (preferred_locale in ('et', 'en', 'ru'));

comment on column public.profiles.preferred_locale is
  'UI language chosen by the user: et, en or ru. Null until chosen.';

grant update (preferred_locale) on table public.profiles to authenticated;
