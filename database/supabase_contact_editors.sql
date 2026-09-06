-- ============================================================
-- MedCare — let editors keep the contact details too
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_scope.sql and supabase_contact_page.sql.
-- Safe to re-run.
--
-- THE CHANGE. site_settings is admin-only to write, and that is right
-- for what lives in it: maintenance mode closes the site, and the notice
-- banner speaks on every page. Neither is an editor's to touch.
--
-- 'footer.contact' is the odd one out. It is an email address and a
-- phone number on a page of the public site — the same kind of thing as
-- the emergency numbers and the hospital list, which are already an
-- editor's to correct. An editor who spots that the office number has
-- changed should not have to find an admin to type it, any more than
-- they need one to fix a hospital's address.
--
-- So this widens exactly one key to editors, and nothing else:
--
--   maintenance   admin only, unchanged
--   notice        admin only, unchanged
--   legal.*       admin only, unchanged
--   footer.contact    editor and admin
--
-- HOW IT IS NARROWED. The key is named in both USING and WITH CHECK, so
-- an editor can neither reach another row through this policy nor use it
-- to turn one row into another. The key is immutable anyway —
-- stamp_site_setting() overwrites any attempt to change it — and the
-- column grant is already `update (value)` alone, so nothing else about
-- the row is reachable either. Three separate reasons, and this file
-- only needs the first.
--
-- POLICIES ARE OR'd. The existing "Admins write/change site settings"
-- policies are untouched and still cover every key for admins. Adding
-- this one takes nothing away from anybody.
--
-- WHAT THIS IS NOT. It is not permission to publish, and not a route
-- into any other setting. An editor still cannot close the site, raise a
-- banner, or edit the legal pages, and there is still no DELETE policy
-- on this table for anybody.
-- ============================================================


-- ============================================================
-- 1. THE POLICIES
-- ============================================================

drop policy if exists "Editors change the contact details" on public.site_settings;
drop policy if exists "Editors create the contact details" on public.site_settings;

create policy "Editors change the contact details"
  on public.site_settings for update to authenticated
  using      ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact')
  with check ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact');

/* The INSERT half exists for one case: a database where
   supabase_contact_page.sql has not been run, so the row is missing and
   the screen's save falls through from update to insert. Without this an
   editor would meet a permissions error on a database an admin simply
   has not migrated yet, which is a confusing way to learn that. Same key,
   same narrowing. */
create policy "Editors create the contact details"
  on public.site_settings for insert to authenticated
  with check ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact');


-- ============================================================
-- 2. CHECKS
-- ============================================================

-- Every policy on the table, and what it is scoped to. Expect the three
-- admin ones unchanged, plus these two naming 'footer.contact' in their
-- rule, and still no DELETE row.
select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;

-- The column grant an editor's save depends on. Expect UPDATE on the
-- `value` column only, to authenticated — the same grant admins use.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'site_settings'
  and grantee in ('authenticated', 'anon')
order by grantee, column_name;
