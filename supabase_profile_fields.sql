-- ============================================================
-- MedCare — full name and username on profiles
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_auth.sql, supabase_rls.sql and supabase_admin.sql.
-- Safe to re-run.
--
-- SUPERSEDED IN PART by supabase_display_name.sql, which renames
-- `username` to `display_name` and drops every rule about its shape and
-- its uniqueness. Run this file first if you are setting up from
-- scratch, then that one; the rename is written to work either way.
--
-- The signup form now asks for three things beyond email and password:
-- a full name, a username to be called by, and the password a second
-- time. The confirmation never leaves the browser — it exists only so a
-- typo cannot lock somebody out of an account they just made. The other
-- two travel with the signup as user METADATA and land here.
--
-- Metadata is whatever the browser sent. Supabase stores it verbatim in
-- auth.users.raw_user_meta_data without checking a thing, so this file
-- treats it as untrusted input: the trigger validates it, the column
-- constraints police it, and the one field that actually grants power —
-- role — is still hard-coded and still never read from the client.
-- ============================================================


-- ---------- 1. THE COLUMNS ----------

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists username  text;

comment on column public.profiles.full_name is
  'Display name as the person writes it. Supplied at signup, validated by the trigger.';
comment on column public.profiles.username is
  'Short handle the site calls them by. Unique, case-insensitively.';

-- Length and shape, enforced by the database rather than by the form.
-- A dropped constraint would be noticed here; a dropped JavaScript check
-- would not be noticed at all.
alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles
  add constraint profiles_full_name_len
  check (full_name is null or char_length(trim(full_name)) between 2 and 80);

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9._-]{3,24}$');

-- Unique on the LOWERCASED value, so "SuAung" cannot be taken twice with
-- different capitalisation. A plain unique constraint would allow that.
-- Several rows may hold NULL: accounts created before this file ran have
-- no username, and unique indexes ignore nulls.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));


-- ---------- 2. "IS THIS NAME FREE?" ----------
-- The signup form has to answer that question before submitting, and it
-- cannot: RLS lets a visitor read their own profile row and nothing else,
-- which is exactly right and also means a client-side SELECT can never
-- see whether a username is taken.
--
-- So the check lives in one narrow SECURITY DEFINER function. It takes a
-- candidate and answers yes or no. It cannot be used to read anybody's
-- row, list usernames, or learn who holds one.
--
-- It does disclose whether a given username exists. That is inherent to
-- every username picker ever built — the alternative is letting people
-- submit a name and then telling them it was taken.

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9._-]{3,24}$'
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = lower(candidate)
     );
$$;

comment on function public.username_available(text) is
  'True when the candidate is well-formed and unclaimed. Answers one question and reveals nothing else.';

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;


-- ---------- 3. THE SIGNUP TRIGGER ----------
-- Replaces the version from supabase_admin.sql. Everything that made it
-- safe is kept: security definer so the insert is allowed while RLS
-- grants nobody insert, an empty search_path so every name is written in
-- full, and a role that is written literally rather than read from input.
--
-- What is new is that two values now come from the browser, so both are
-- checked here. The username is REJECTED when malformed rather than
-- quietly cleaned up: a signup that silently renames you is worse than
-- one that fails and says why.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  meta_username  text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  if meta_full_name is not null and char_length(meta_full_name) > 80 then
    meta_full_name := left(meta_full_name, 80);
  end if;

  if meta_username is not null and meta_username !~ '^[A-Za-z0-9._-]{3,24}$' then
    raise exception 'username_invalid'
      using errcode = '22023',
            hint = '3 to 24 characters: letters, numbers, dots, dashes or underscores.';
  end if;

  insert into public.profiles as p (id, role, email, full_name, username)
  values (new.id, 'user', new.email, meta_full_name, meta_username)
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, p.full_name),
        username  = coalesce(excluded.username,  p.username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A taken username raises 23505 from the unique index above, which aborts
-- the signup: no auth.users row, no profile, nothing half-created. The
-- form checks availability first, so this is the race-condition path —
-- two people claiming the same name in the same second — and login.js
-- turns it back into "that username was just taken".


-- ---------- 4. COLUMN PRIVILEGES ----------
-- supabase_admin.sql narrowed browser writes on profiles to `role` alone
-- and that still holds: nothing here widens it. These two columns are
-- written by the trigger, never by the browser, so there is no way for
-- somebody to rewrite their name after signup from the client — and no
-- way to rewrite anybody else's either.
--
-- Re-stated rather than assumed, since this file adds the columns those
-- privileges have to keep excluding.

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role) on public.profiles to authenticated;


-- ---------- 5. CHECKS ----------

-- Columns and constraints.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('full_name', 'username')
order by column_name;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname in ('profiles_full_name_len', 'profiles_username_format');

-- The availability function should answer true for a free name and false
-- for a malformed one.
select public.username_available('a_free_name')  as should_be_true,
       public.username_available('no')           as too_short,
       public.username_available('has spaces')   as bad_characters;

-- authenticated must still hold UPDATE on `role` only.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;

-- Accounts and what they are called.
select email, username, full_name, role
from public.profiles
order by created_at;
