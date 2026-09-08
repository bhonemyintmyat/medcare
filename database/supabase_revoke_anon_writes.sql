revoke insert, update, delete on public.diseases           from anon;
revoke insert, update, delete on public.articles           from anon;
revoke insert, update, delete on public.hospitals          from anon;
revoke insert, update, delete on public.emergency_contacts from anon;

revoke insert, update, delete on public.reports from anon;

revoke insert, update, delete on public.profiles from anon;

select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
order by table_name, privilege_type;

select table_name, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and grantee = 'anon'
  and privilege_type = 'SELECT'
order by table_name;

select table_name, grantee, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
  and privilege_type = 'UPDATE'
order by table_name, grantee, column_name;
