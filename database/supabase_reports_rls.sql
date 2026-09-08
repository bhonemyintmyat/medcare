alter table public.reports alter column user_id set default auth.uid();

revoke update, delete on public.reports from anon, authenticated;

grant update (status) on public.reports to authenticated;

drop policy if exists "Users can file their own reports" on public.reports;
drop policy if exists "Users can read their own reports" on public.reports;
drop policy if exists "Staff can read all reports"       on public.reports;
drop policy if exists "Staff can update report status"   on public.reports;

create policy "Users can file their own reports"
  on public.reports
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'new'
  );

create policy "Users can read their own reports"
  on public.reports
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Staff can read all reports"
  on public.reports
  for select
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Staff can update report status"
  on public.reports
  for update
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

select policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename = 'reports'
order by cmd, policyname;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
