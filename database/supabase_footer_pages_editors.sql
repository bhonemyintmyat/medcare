drop policy if exists "Admins change pages"  on public.pages;
drop policy if exists "Editors change pages" on public.pages;

create policy "Editors change pages"
  on public.pages for update to authenticated
  using      ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'pages'
order by cmd, policyname;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'pages'
  and grantee = 'authenticated' and privilege_type = 'UPDATE'
order by column_name;
