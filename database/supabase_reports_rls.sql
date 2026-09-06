-- ============================================================
-- MedCare — RLS policies for public.reports
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: policies and grants are reset before being applied.
--
-- Intended rules:
--   file a report      signed-in users, for themselves, always as 'new'
--   read own reports   the person who filed it
--   read all reports   editor / admin (the moderation queue)
--   mark as reviewed   editor / admin, and ONLY the status column
--   delete             nobody from the browser
--
-- Depends on public.my_role() from supabase_rls.sql.
-- ============================================================


-- ---------- 0. SERVER-SIDE DEFAULT FOR user_id ----------
-- With this, the browser sends only { item_type, item_id, reason } and the
-- database fills in who is reporting. It cannot be forgotten, and it cannot
-- be pointed at somebody else, because the policy below re-checks it.
--
-- Same caution as `status default 'new'`: a DEFAULT only applies when the
-- column is OMITTED. It is convenience, not enforcement. The WITH CHECK in
-- the insert policy is what actually stops impersonation.

-- Note: a plain function call, NOT `(select auth.uid())`. Subqueries are
-- not permitted in a DEFAULT expression. The `(select ...)` wrapper used
-- in the policies below is a policy-only optimisation.
alter table public.reports alter column user_id set default auth.uid();


-- ---------- 1. COLUMN PRIVILEGES ----------
-- RLS decides WHICH ROWS you may touch. It cannot say WHICH COLUMNS.
-- An editor allowed to update a report row could otherwise rewrite the
-- reader's `reason`, or re-point it at another disease. Column-level
-- GRANTs are the right tool for that, and they are checked before RLS.

-- Start from a clean slate (Supabase grants everything by default).
revoke update, delete on public.reports from anon, authenticated;

-- Editors may set exactly one column. An UPDATE touching anything else is
-- rejected outright, whatever the policies say.
grant update (status) on public.reports to authenticated;

-- DELETE stays revoked. Reports are an audit trail; nothing in the browser
-- should be able to erase them. Revoking (rather than just omitting a
-- policy) also turns a delete attempt into a clear permission error instead
-- of a silent "204, zero rows affected".


-- ---------- 2. POLICIES ----------

drop policy if exists "Users can file their own reports" on public.reports;
drop policy if exists "Users can read their own reports" on public.reports;
drop policy if exists "Staff can read all reports"       on public.reports;
drop policy if exists "Staff can update report status"   on public.reports;

-- INSERT: a signed-in reader files a report about something.
--
-- The two conditions are doing different jobs, and both matter:
--
--   user_id = auth.uid()  stops impersonation. Without it, anyone could
--                         post a report attributed to another account.
--
--   status = 'new'        stops queue-skipping. This is the enforcement
--                         the `default 'new'` does NOT provide: a default
--                         is ignored the moment the client supplies a
--                         value, so without this line a user could insert
--                         status = 'reviewed' and never appear in the
--                         moderation list.
create policy "Users can file their own reports"
  on public.reports
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new'
  );

-- SELECT: you can see what you reported, so the UI can say "you already
-- reported this" or show that it was dealt with.
create policy "Users can read their own reports"
  on public.reports
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- SELECT: staff see everything. This is the moderation queue.
-- Note both select policies are PERMISSIVE, so they combine with OR:
-- an editor matches this one, a reader matches the one above.
create policy "Staff can read all reports"
  on public.reports
  for select
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

-- UPDATE: staff mark a report reviewed.
--   USING      -> which rows they may touch (any)
--   WITH CHECK -> what the row may become (still theirs to hold)
-- The column grant above is what limits them to `status`; RLS alone
-- could not express that.
create policy "Staff can update report status"
  on public.reports
  for update
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

-- DELIBERATELY ABSENT:
--   * no policy for `anon` at all -> logged-out visitors cannot file or
--     read reports. To allow anonymous reporting later, add an insert
--     policy `to anon with check (user_id is null and status = 'new')`.
--   * no delete policy, and DELETE is revoked -> the audit trail stands.
--   * no policy letting a reader edit their own report. Editing the
--     reason after review would undermine the record; file a new one.


-- ---------- 3. CHECKS ----------

select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename = 'reports'
order by cmd, policyname;

-- Column privileges: authenticated should hold UPDATE on `status` only.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;

-- Table privileges: no DELETE for anon/authenticated.
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
