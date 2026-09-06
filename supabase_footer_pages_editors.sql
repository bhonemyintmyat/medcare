-- ============================================================
-- MedCare — let editors keep the footer pages too
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_footer_pages.sql.
-- Safe to re-run.
--
-- THIS REVERSES A DECISION, AND SAYS SO
--
-- supabase_contact_editors.sql widened exactly one site_settings key to
-- editors and wrote down, twice, that the legal text was not theirs:
--
--     legal.*  admin only, unchanged
--     "An editor still cannot close the site, raise a banner, or edit
--      the legal pages."
--
-- supabase_footer_pages.sql then built public.pages under that rule and
-- granted UPDATE to admins alone. This file changes that rule. It is not
-- a correction of a mistake — the earlier reasoning was sound — it is a
-- different answer to the same question, and the person running the site
-- is entitled to give one.
--
-- WHAT THE OLD RULE WAS FOR. Terms, privacy and cookies are the pages a
-- reader is held to and the pages that describe what the site does with
-- them. Getting one wrong is not like getting a hospital's phone number
-- wrong: nobody notices, and it is still wrong months later. Keeping one
-- pair of hands on them meant a smaller set of people to ask.
--
-- WHAT IS TRUE EITHER WAY. Four editors and two admins run this site,
-- and an editor who spots that the privacy policy describes a feature
-- that no longer exists had to find an admin to type the correction. The
-- same argument the contact details won on — an editor who can fix a
-- hospital's address can fix a phone number — reaches these pages once
-- you decide that a stale policy is worse than a wrongly-worded one.
--
-- WHAT DOES NOT CHANGE, AND WHY IT STILL MATTERS
--
--   maintenance   admin only. Closing the site is not an edit.
--   notice        admin only. It speaks on every page.
--   INSERT/DELETE on pages   admin only, and there is still no DELETE
--                 policy for anybody. The four rows are created by the
--                 migration; a screen that could invent a page could
--                 invent one no file renders.
--   slug, href    still outside the column grant, so an editor can
--                 change the words on a page and not which page it is.
--
-- So an editor gains exactly one thing: the ability to write title, body
-- and body_my on a row that already exists. Everything that decides
-- WHICH page, and whether the site is open, stays where it was.
-- ============================================================


-- ============================================================
-- 1. THE POLICY
-- ============================================================
/* Replaced rather than added alongside. Policies are OR'd, so leaving
   the admin-only one in place and adding an editor one would work — but
   then two policies would describe the same operation and a later reader
   would have to hold both in their head to know who may write. One
   policy, naming both roles, is the same rule written once. */

drop policy if exists "Admins change pages"  on public.pages;
drop policy if exists "Editors change pages" on public.pages;

create policy "Editors change pages"
  on public.pages for update to authenticated
  using      ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

/* INSERT is deliberately untouched: "Admins write pages" from
   supabase_footer_pages.sql still names 'admin' alone. */


-- ============================================================
-- 2. CHECKS
-- ============================================================

-- Every policy on the table. Expect SELECT for anon+authenticated,
-- INSERT naming 'admin', UPDATE naming 'editor' and 'admin', and still
-- no DELETE row.
select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'pages'
order by cmd, policyname;

-- The column grant an editor's save depends on. Expect UPDATE on
-- title, body and body_my only — slug and href must NOT appear.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'pages'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
