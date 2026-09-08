drop policy if exists "Editors change the contact details" on public.site_settings;
drop policy if exists "Editors create the contact details" on public.site_settings;

create policy "Editors change the contact details"
  on public.site_settings for update to authenticated
  using      ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact')
  with check ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact');

create policy "Editors create the contact details"
  on public.site_settings for insert to authenticated
  with check ((select public.my_role()) in ('editor', 'admin') and key = 'footer.contact');

select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'site_settings'
  and grantee in ('authenticated', 'anon')
order by grantee, column_name;
