-- ============================================================
-- MedCare — Row Level Security policies
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: every policy is dropped before being recreated.
--
-- Rules enforced here:
--   diseases : anyone (even logged out) may read
--              only editor/admin may insert, update, delete
--   profiles : a user may read their own row
--              only admin may change roles
-- ============================================================


-- ---------- 0. THE ROLE HELPER ----------
-- Policies need to ask "what is this user's role?", which means reading
-- public.profiles. A policy ON profiles that itself reads profiles causes
-- Postgres error 42P17, "infinite recursion detected in policy". This
-- function is the standard way out: SECURITY DEFINER runs it as its owner,
-- so it does NOT re-trigger RLS, and the recursion never starts.
--
-- It can only ever return the CALLER's own role: auth.uid() comes from the
-- verified JWT and cannot be supplied or spoofed by the browser.

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

comment on function public.my_role() is
  'Returns the calling user''s role. SECURITY DEFINER so RLS policies can call it without recursion.';


-- ============================================================
-- 1. DISEASES
-- ============================================================

alter table public.diseases enable row level security;

-- Drop anything already there. Policies are PERMISSIVE and combine with OR,
-- so one forgotten policy can silently widen access. Never leave strays.
drop policy if exists "Public can read diseases"   on public.diseases;
drop policy if exists "Anyone can read diseases"   on public.diseases;
drop policy if exists "Staff can insert diseases"  on public.diseases;
drop policy if exists "Staff can update diseases"  on public.diseases;
drop policy if exists "Staff can delete diseases"  on public.diseases;

-- READ: everyone, signed in or not.
-- `to anon, authenticated` is what includes logged-out visitors.
create policy "Anyone can read diseases"
  on public.diseases
  for select
  to anon, authenticated
  using (true);

-- INSERT: editor/admin only.
-- INSERT takes WITH CHECK, not USING — there is no existing row to test,
-- only the proposed new one.
create policy "Staff can insert diseases"
  on public.diseases
  for insert
  to authenticated
  with check ((select public.my_role()) in ('editor', 'admin'));

-- UPDATE: editor/admin only. Needs BOTH clauses:
--   USING      -> which existing rows you are allowed to touch
--   WITH CHECK -> what the row is allowed to look like afterwards
-- Omit WITH CHECK and a user who passes USING can rewrite the row freely.
create policy "Staff can update diseases"
  on public.diseases
  for update
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

-- DELETE: editor/admin only.
create policy "Staff can delete diseases"
  on public.diseases
  for delete
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));


-- ============================================================
-- 2. PROFILES
-- ============================================================

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile"  on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can change roles"     on public.profiles;

-- READ own row only. auth.uid() is the id from the verified token, so
-- ?id=eq.<someone-else> simply returns nothing.
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- READ all rows, admins only. Needed so an admin can see who exists in
-- order to promote them. This is the policy that would recurse without
-- my_role() above. Drop it if you do not want an in-app admin list.
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.my_role()) = 'admin');

-- UPDATE (i.e. change a role): admins only.
-- USING      -> an admin may target any row
-- WITH CHECK -> and the result must still satisfy admin-ness
create policy "Admins can change roles"
  on public.profiles
  for update
  to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

-- STILL DELIBERATELY ABSENT: any INSERT or DELETE policy, and any UPDATE
-- policy for ordinary users.
--   * No user-facing UPDATE -> nobody can run
--       update profiles set role = 'admin' where id = auth.uid()
--     A policy of `using (auth.uid() = id)` looks correct and hands every
--     user an admin promotion. This is the mistake to never make.
--   * No INSERT -> the browser cannot create a profile with a chosen role.
--     Rows come only from the on_auth_user_created trigger, which
--     hard-codes 'user'.
--   * No DELETE -> profiles disappear only via the cascade from auth.users.


-- ============================================================
-- 3. CHECKS
-- ============================================================

-- Both tables must show rowsecurity = true.
select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid in ('public.diseases'::regclass, 'public.profiles'::regclass);

-- Every policy, with the roles it applies to and its expressions.
select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename in ('diseases', 'profiles')
order by tablename, cmd, policyname;

-- Promote someone (run here, as the SQL editor bypasses RLS):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
