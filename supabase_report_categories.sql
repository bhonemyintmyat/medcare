-- ============================================================
-- MedCare — add `category` to public.reports
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql and supabase_editor.sql, which are
-- what the live `reports` table actually reflects. Safe to re-run.
--
-- A NOTE ON WHICH SCHEMA THIS TARGETS. supabase_reports.sql and
-- supabase_reports_rls.sql describe the ORIGINAL shape of this table:
-- user_id / item_type / item_id, and status new|reviewed. The moderation
-- migration in supabase_admin_schema.sql renamed all three and moved
-- status to open|resolved|dismissed, and supabase_editor.sql set the
-- policies that are live now. This file is written against the current
-- table; the two earlier files are history and should be read as such.
--
-- WHY. Until now a report was one free-text `reason`, and an editor had
-- to read every one to find out whether it was a medical claim to check
-- or a missing letter in a heading. Those two need different people and
-- different urgency. Asking the reader to pick a category up front is
-- the cheapest way to get that sorting done by the person who already
-- knows the answer.
--
-- The category does NOT replace `reason`. It routes; the prose is still
-- what an editor acts on, so `reason` stays required.
-- ============================================================


-- ---------- 1. THE COLUMN ----------
--
-- NOT NULL with a DEFAULT, added in one statement, so the rows already
-- in the table are filled in rather than rejected. 'other' is the
-- honest value for them: those reports were filed before anyone was
-- asked, so the category is genuinely unknown, and inventing
-- 'inaccuracy' for them would put made-up data in front of an editor.
--
-- The default is also what keeps an older cached copy of report.js
-- working: it omits the column, and the row still lands.

alter table public.reports
  add column if not exists category text not null default 'other';


-- ---------- 2. THE ALLOWED VALUES ----------
--
-- A check constraint rather than an enum type. The list will change —
-- 'outdated guidance' and 'missing source' are already plausible — and
-- widening a check constraint is one statement, while altering an enum
-- is a type change that ripples into every dependent object.
--
-- Dropped and re-added so the file can be re-run after the list grows.

alter table public.reports drop constraint if exists reports_category_check;

alter table public.reports
  add constraint reports_category_check
  check (category in ('inaccuracy', 'typo', 'broken_link', 'other'));

comment on column public.reports.category is
  'What kind of problem the reader is reporting. Routes the report to the right person; `reason` is still what they act on. Defaults to ''other'' so pre-existing rows and older clients remain valid.';


-- ---------- 3. WHAT DELIBERATELY DID NOT CHANGE ----------
--
-- No policy edits. The insert policy is:
--
--     with check (reporter_id = (select auth.uid()) and status = 'open')
--
-- It constrains who may file and in what state, and it says nothing
-- about the payload's other columns — so a new column is covered by it
-- without being named in it. The check constraint above is what limits
-- the value, and a constraint applies to every writer, including the
-- service role and the SQL editor. That is the right split: RLS decides
-- WHOSE row this is, constraints decide whether the row makes sense.
--
-- No grant edits either. `authenticated` holds table-level INSERT, which
-- covers columns added later. The UPDATE grant is still
-- `(status, resolution_note)` and nothing more, so an editor working the
-- queue cannot rewrite the reader's chosen category any more than they
-- can rewrite the reason — both are the reader's testimony, not the
-- editor's notes. Verified after applying this file: the UPDATE column
-- privileges for `authenticated` are still exactly those two.
--
-- Nothing is granted to `anon`; supabase_revoke_anon_writes.sql took
-- INSERT away there, and this column does not give it back.
--
-- STATUS: applied to the live project on 2026-08-28, and the checks in
-- section 5 were run against it.


-- ---------- 4. INDEX ----------
-- "show me the medical-accuracy reports still waiting", which is the
-- one queue view that actually needs to be fast.

create index if not exists reports_category_status_idx
  on public.reports (category, status, created_at desc);


-- ---------- 5. CHECKS ----------

-- The column: text, not null, default 'other'.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reports' and column_name = 'category';

-- The constraint, and what it allows.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.reports'::regclass and conname = 'reports_category_check';

-- Existing rows were backfilled, not dropped.
select category, count(*) from public.reports group by category order by category;

-- Should fail with 23514, check constraint violation. Uncomment to try:
-- insert into public.reports (target_type, target_id, reason, category)
-- values ('article', 1, 'ten characters at least', 'nonsense');

-- UPDATE is still limited to `status` and `resolution_note`:
-- `category` must NOT appear here.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;
