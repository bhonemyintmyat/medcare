



alter table public.profiles
  add column if not exists email text;

comment on column public.profiles.email is
  'Copy of auth.users.email, maintained by trigger. Display only: auth.users stays the source of truth.';


update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is distinct from u.email;




create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, email)
  values (new.id, 'user', new.email)   -- role is still hard-coded
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();



create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();




revoke update, insert, delete on public.profiles from anon, authenticated;

grant update (role) on public.profiles to authenticated;






drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can change roles"      on public.profiles;


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














select p.id
from public.profiles p
where p.email is null;


select email, role, created_at
from public.profiles
order by created_at;


select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;


select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'DELETE')
order by grantee, privilege_type;


select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal
order by tgname;
