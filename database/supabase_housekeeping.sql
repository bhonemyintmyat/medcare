create or replace function public.accounts_without_profile()
returns table (id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.my_role()) is distinct from 'admin' then
    raise exception 'Only an admin may list accounts without a profile'
      using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at;
end;
$$;

comment on function public.accounts_without_profile() is
  'Accounts in auth.users with no row in public.profiles. Admin only; raises 42501 otherwise. Reads only, and never creates the missing profile — the backfill in supabase_auth.sql does that, deliberately.';

revoke execute on function public.accounts_without_profile() from public, anon;
grant  execute on function public.accounts_without_profile() to authenticated;

select * from public.accounts_without_profile();

select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'accounts_without_profile'
order by grantee;
