-- ============================================================
-- MedCare — what admin.html needs from the database
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_auth.sql and supabase_rls.sql. Safe to re-run.
--
-- The admin dashboard lists every account so an admin can change roles.
-- Two things are missing for that:
--
--   1. An email to show. `profiles` holds only id, role, created_at, and
--      the browser cannot read auth.users at all — that table is not in
--      the public schema and is not exposed through the API, deliberately.
--      So the email is COPIED into profiles by the same trigger that
--      creates the row, and kept in step by a second trigger.
--
--   2. A narrower write. "Admins can change roles" (supabase_rls.sql)
--      allows an admin to update a profile row — every column of it,
--      including the copied email. RLS chooses ROWS; only a column GRANT
--      can choose COLUMNS. Step 3 does that, exactly as
--      supabase_reports_rls.sql does for reports.status.
-- ============================================================


-- ---------- 1. THE EMAIL COLUMN ----------

alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is
  'Copy of auth.users.email, maintained by trigger. Display only: auth.users stays the source of truth.';

-- Backfill the accounts that already exist.
update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;


-- ---------- 2. KEEP IT IN STEP ----------
-- Replaces the function from supabase_auth.sql. Everything that made
-- that version safe is kept: security definer so the insert is allowed
-- while RLS grants nobody insert, an empty search_path so every name
-- must be written in full, and a hard-coded role that the client can
-- never influence.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'user', new.email)   -- role is still hard-coded
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A person can change their email address later. Without this the
-- dashboard would keep showing the old one forever.

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();


-- ---------- 3. COLUMN PRIVILEGES ----------
-- The dashboard sends only { role: '...' }. This makes that the ONLY
-- thing it is able to send: an update touching any other column is
-- rejected before RLS is even consulted.
--
-- Without it, an admin (or anything running with an admin's token)
-- could rewrite the copied email, or the created_at date, from the
-- browser. Neither is data the browser should be authoring.

revoke update, insert, delete on public.profiles from anon, authenticated;

grant update (role) on public.profiles to authenticated;

-- INSERT stays revoked: rows come only from the trigger above.
-- DELETE stays revoked: profiles disappear only with their auth.users row.


-- ---------- 4. THE POLICIES THIS PAGE RELIES ON ----------
-- Already created by supabase_rls.sql. Repeated here so this file can
-- be read on its own, and so a project that skipped that step is not
-- left with a dashboard that silently lists one row.

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can change roles"      on public.profiles;

-- READ every row: admins only. my_role() is SECURITY DEFINER, which is
-- what stops a policy on profiles that reads profiles from recursing
-- (Postgres error 42P17).
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.my_role()) = 'admin');

-- UPDATE a role: admins only.
--   USING      -> an admin may target any row
--   WITH CHECK -> and the row must still satisfy the same test after
create policy "Admins can change roles"
  on public.profiles
  for update
  to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

-- STILL DELIBERATELY ABSENT: any UPDATE policy for ordinary users. An
-- innocent-looking `using (auth.uid() = id)` would let every reader run
-- `update profiles set role = 'admin'` on themselves. Never add it.


-- ---------- 5. YOUR FIRST ADMIN ----------
-- Nothing in the browser can create one: with no admin, no one passes
-- "Admins can change roles". The first promotion happens here, in the
-- SQL editor, which runs as service_role and bypasses RLS.

--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');

-- After that, admin.html can promote everybody else.


-- ---------- 6. CHECKS ----------

-- Every profile should now carry an email (expect 0 rows back).
select p.id
from public.profiles p
where p.email is null;

-- Accounts and roles, as the dashboard will show them.
select email, role, created_at
from public.profiles
order by created_at;

-- authenticated must hold UPDATE on `role` and nothing else.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;

-- No INSERT or DELETE for anon/authenticated (expect 0 rows back).
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'DELETE')
order by grantee, privilege_type;

-- Both triggers must be present on auth.users.
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal
order by tgname;
