-- ============================================================
-- MedCare — take write privileges away from anonymous visitors
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql. Safe to re-run.
--
-- WHY, WHEN NOTHING WAS BROKEN. Probing the live tables as an anonymous
-- reader, every write already failed. But they failed in two different
-- ways:
--
--   insert into reports   ->  42501, permission denied
--   update  hospitals     ->  200 OK, 0 rows affected
--
-- The second one is RLS doing its job: no policy grants anon an UPDATE,
-- so no row matches and nothing changes. It is safe. It is also silent,
-- and a silent success is a poor smoke alarm — it looks identical to
-- "the row you asked for wasn't there", which is what you would also
-- see if a policy were quietly dropped tomorrow.
--
-- Supabase grants `anon` table-level INSERT/UPDATE/DELETE on new tables
-- in the public schema by default, which is what leaves that path open
-- as far as the privilege check. Closing it means an anonymous write is
-- refused before RLS is consulted, and refused loudly.
--
-- This is defence in depth, not a fix: the policies were, and remain,
-- what actually decides. Nothing here changes what any signed-in
-- account can do.
-- ============================================================


-- ---------- 1. THE CONTENT TABLES ----------
-- SELECT is deliberately untouched: the public site reads these, and
-- the policies limit that read to status = 'published'.

revoke insert, update, delete on public.diseases           from anon;
revoke insert, update, delete on public.articles           from anon;
revoke insert, update, delete on public.hospitals          from anon;
revoke insert, update, delete on public.emergency_contacts from anon;


-- ---------- 2. REPORTS ----------
-- Already refused by policy; now refused a step earlier. Reading stays
-- revoked at the policy level, where an anonymous SELECT simply matches
-- nothing.

revoke insert, update, delete on public.reports from anon;


-- ---------- 3. PROFILES ----------
-- supabase_admin.sql and supabase_admin_schema.sql already revoke these
-- from anon and authenticated, and grant back the four columns an
-- account may write on its own row. Repeated here only so this file
-- shows the whole anonymous boundary in one place rather than half of
-- it.

revoke insert, update, delete on public.profiles from anon;


-- ---------- WHAT IS STILL OPEN, ON PURPOSE ----------
--   anon SELECT on diseases, articles, hospitals, emergency_contacts
--     -> the public site. Policies limit it to published rows.
--   authenticated INSERT/UPDATE/DELETE on the content tables
--     -> editors and admins need them; the policies decide who, and
--        which rows. A signed-in reader passes no policy, so their
--        update still matches zero rows.
--
-- Future tables will arrive with Supabase's default grants again. Any
-- new table wants its own revoke, in the same block that creates it.


-- ---------- CHECKS ----------

-- Expect NO rows: anon should hold no write privilege anywhere.
select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, privilege_type;

-- Expect one SELECT row per public table: the site still has to read.
select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'SELECT'
order by table_name;

-- And the column-level grants that survive for signed-in accounts.
select table_name, grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'UPDATE'
order by table_name, grantee, column_name;
