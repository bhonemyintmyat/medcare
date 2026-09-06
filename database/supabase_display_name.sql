-- ============================================================
-- MedCare — display names, with no rules about what they may be
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run, and safe whether or not the earlier username
-- version was ever applied.
--
-- WHAT CHANGED AND WHY. The first version of this called the field a
-- `username` and policed it: 3 to 24 characters, Latin letters, digits
-- and three punctuation marks, unique across the site. That is a login
-- handle's rule set, and this field is not a login handle — nobody
-- signs in with it, nothing is addressed to it, it is simply what the
-- site calls you instead of showing your email address.
--
-- Those rules also quietly said that a name written in Burmese was not
-- a name, on a site whose readers are in Myanmar. So they are gone:
--
--   any characters, any script       က, ဆ, spaces, punctuation, emoji
--   no minimum length beyond "not empty"
--   NOT unique — two people may both be called "Su"
--
-- What survives is not a rule about names but a limit on strings: it
-- must not be blank, and it stops at 60 characters so a pasted novel
-- cannot land in a navbar. Change the 60 if you want it longer.
-- ============================================================


-- ---------- 1. THE COLUMN ----------
-- Three starting points are possible: the column is already called
-- display_name (re-run), it is still called username (the earlier file
-- was applied), or neither exists (fresh project). This handles all
-- three rather than assuming one.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) then
    alter table public.profiles rename column username to display_name;
  end if;
end
$$;

alter table public.profiles
  add column if not exists display_name text;

comment on column public.profiles.display_name is
  'What the site calls this person instead of their email. Any characters, not unique, never used to sign in.';


-- ---------- 2. THE OLD RULES COME OFF ----------

-- The unique index is what made two people unable to share a name.
drop index if exists public.profiles_username_lower_idx;

-- The Latin-only, 3-to-24 pattern.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles drop constraint if exists profiles_display_name_format;

-- What replaces them: not blank, and bounded. Note the trim() — a name
-- of nothing but spaces is blank however many spaces it is.
alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles
  add constraint profiles_display_name_len
  check (display_name is null or char_length(trim(display_name)) between 1 and 60);

-- Nothing needs to ask "is this name free?" any more.
drop function if exists public.username_available(text);


-- ---------- 3. SETTING YOUR OWN ----------
-- Replaces set_username() if that was ever created.
--
-- Still a SECURITY DEFINER function rather than an RLS policy, and the
-- reason is worth keeping in view: supabase_admin.sql grants UPDATE
-- (role) to the `authenticated` role — to all of them — and only the
-- admin-only policy stops it being used. A permissive own-row UPDATE
-- policy would combine with that grant and let any signed-in person run
--
--     update profiles set role = 'admin' where id = auth.uid();
--
-- So there is no such policy. This function writes one column, on one
-- row, chosen by the verified token rather than by an argument.

drop function if exists public.set_username(text);

create or replace function public.set_display_name(new_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  cleaned text := nullif(trim(new_name), '');
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if cleaned is null then
    raise exception 'display_name_blank' using errcode = '22023';
  end if;

  if char_length(cleaned) > 60 then
    raise exception 'display_name_too_long' using errcode = '22001';
  end if;

  -- Newlines and tabs would break a single-line header, so they become
  -- ordinary spaces. This is layout hygiene, not a rule about names:
  -- every visible character the person typed survives it.
  cleaned := trim(regexp_replace(cleaned, '[\n\r\t]+', ' ', 'g'));

  update public.profiles
     set display_name = cleaned
   where id = uid;

  return cleaned;
end;
$$;

comment on function public.set_display_name(text) is
  'Sets the calling user''s own display name. The only path by which a browser may write to profiles other than an admin changing a role.';

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to authenticated;


-- ---------- 4. THE SIGNUP TRIGGER ----------
-- Reads display_name from the signup metadata now. Metadata is whatever
-- the browser sent, so it is trimmed and capped here rather than
-- trusted — but it is no longer REJECTED for its shape, because there
-- is no shape to be wrong. role is still written literally.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  meta_display   text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if meta_full_name is not null then
    meta_full_name := left(meta_full_name, 80);
  end if;

  if meta_display is not null then
    meta_display := trim(left(regexp_replace(meta_display, '[\n\r\t]+', ' ', 'g'), 60));
    meta_display := nullif(meta_display, '');
  end if;

  insert into public.profiles as p (id, role, email, full_name, display_name)
  values (new.id, 'user', new.email, meta_full_name, meta_display)
  on conflict (id) do update
    set email        = excluded.email,
        full_name    = coalesce(excluded.full_name, p.full_name),
        display_name = coalesce(excluded.display_name, p.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- 5. COLUMN PRIVILEGES ----------
-- Unchanged, and re-stated because this file is the one that widens
-- things: `role` is still the only column the browser may UPDATE, and
-- only an admin passes the policy that allows it. display_name is
-- written by the function above, never by a direct update.

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role) on public.profiles to authenticated;


-- ---------- 6. CHECKS ----------

-- The column is called display_name and username is gone.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('username', 'display_name');

-- One constraint on it, and it is only about length.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like 'profiles_display_name%';

-- The unique index should be gone (expect no rows).
select indexname from pg_indexes
where schemaname = 'public' and tablename = 'profiles'
  and indexname = 'profiles_username_lower_idx';

-- The functions: set_display_name present, the username pair gone.
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('set_display_name', 'set_username', 'username_available')
order by proname;

-- Names as they stand.
select email, display_name, full_name, role
from public.profiles
order by created_at;
