



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




alter table public.diseases enable row level security;


drop policy if exists "Public can read diseases"   on public.diseases;
drop policy if exists "Anyone can read diseases"   on public.diseases;
drop policy if exists "Staff can insert diseases"  on public.diseases;
drop policy if exists "Staff can update diseases"  on public.diseases;
drop policy if exists "Staff can delete diseases"  on public.diseases;


create policy "Anyone can read diseases"
  on public.diseases
  for select
  to anon, authenticated
  using (true);


create policy "Staff can insert diseases"
  on public.diseases
  for insert
  to authenticated
  with check ((select public.my_role()) in ('editor', 'admin'));


create policy "Staff can update diseases"
  on public.diseases
  for update
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));


create policy "Staff can delete diseases"
  on public.diseases
  for delete
  to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));




alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile"  on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can change roles"     on public.profiles;


create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);


create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.my_role()) = 'admin');


create policy "Admins can change roles"
  on public.profiles
  for update
  to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');







select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid in ('public.diseases'::regclass, 'public.profiles'::regclass);


select tablename, policyname, cmd, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename in ('diseases', 'profiles')
order by tablename, cmd, policyname;


