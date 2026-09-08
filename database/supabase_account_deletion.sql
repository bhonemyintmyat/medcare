do $$
begin
  if not has_table_privilege(current_user, 'auth.users', 'delete') then
    raise notice
      'MedCare: % cannot delete from auth.users. Both functions in this file will deploy, and will fail when called. Run this file as postgres, or grant delete on auth.users to %.',
      current_user, current_user;
  end if;
end
$$;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if to_regprocedure('extensions.crypt(text, text)') is null then
    raise notice
      'MedCare: extensions.crypt(text, text) is missing, so delete_own_account() will deploy and then refuse every password it is given. Install pgcrypto into the extensions schema.';
  end if;
end
$$;

drop function if exists public.delete_own_account();

create or replace function public.delete_own_account(confirm_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  stored  text;
  my_role text;
  gone_by text;
begin
  if uid is null then
    raise exception 'not_signed_in'
      using errcode = '28000',
            hint = 'Sign in again and try once more.';
  end if;

  select u.encrypted_password
    into stored
    from auth.users u
   where u.id = uid;

  if not found then
    raise exception 'not_signed_in'
      using errcode = '28000',
            hint = 'This account no longer exists. Sign in again.';
  end if;

  if stored is null or stored = '' then
    raise exception 'no_password_set'
      using errcode = '28P01',
            hint = 'This account has no password to confirm with. Set one from "Forgot your password?" on the sign-in screen, then delete the account.';
  end if;

  if stored is distinct from extensions.crypt(coalesce(confirm_password, ''), stored) then
    raise exception 'wrong_password'
      using errcode = '28P01',
            hint = 'That is not the password for this account. Nothing has been deleted.';
  end if;

  select p.role,
         coalesce(p.display_name, p.full_name, p.email, 'your account')
    into my_role, gone_by
    from public.profiles p
   where p.id = uid;

  if not found then
    my_role := 'user';
    gone_by := 'your account';
  end if;

  if my_role = 'admin'
     and (select count(*) from public.profiles p where p.role = 'admin') <= 1 then
    raise exception 'last_admin_forbidden'
      using errcode = '42501',
            hint = 'You are the only admin. Make somebody else an admin first, then delete your account.';
  end if;

  delete from auth.users u where u.id = uid;

  return gone_by;
end;
$$;

comment on function public.delete_own_account(text) is
  'Deletes the calling user''s own account and everything that cascades from it. Takes no id — the account comes from the verified token — only that account''s own password, checked against auth.users. Refuses a wrong password, and refuses the last admin.';

revoke all on function public.delete_own_account(text) from public, anon;
grant execute on function public.delete_own_account(text) to authenticated;

create or replace function public.delete_account(target_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  gone_by text;
begin
  if caller is null then
    raise exception 'not_signed_in'
      using errcode = '28000',
            hint = 'Sign in again and try once more.';
  end if;

  if (select public.my_role()) <> 'admin' then
    raise exception 'delete_forbidden'
      using errcode = '42501',
            hint = 'Only an admin may delete somebody else''s account.';
  end if;

  if target_id is null then
    raise exception 'account_not_found'
      using errcode = 'P0002',
            hint = 'No account was named.';
  end if;

  if target_id = caller then
    raise exception 'delete_self_forbidden'
      using errcode = '42501',
            hint = 'Delete your own account from your account menu, not from the accounts list.';
  end if;

  select coalesce(p.display_name, p.full_name, p.email, 'that account')
    into gone_by
    from public.profiles p
   where p.id = target_id;

  if not found then
    raise exception 'account_not_found'
      using errcode = 'P0002',
            hint = 'No account has that id. Refresh the list.';
  end if;

  delete from auth.users u where u.id = target_id;

  return gone_by;
end;
$$;

comment on function public.delete_account(uuid) is
  'Deletes another person''s account. Admins only, and never the caller''s own — that is delete_own_account(). Returns the name the site used to call them, so the confirmation can say who is gone.';

revoke all on function public.delete_account(uuid) from public, anon;
grant execute on function public.delete_account(uuid) to authenticated;

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role, display_name, full_name, locale) on public.profiles to authenticated;

select p.proname,
       pg_get_function_arguments(p.oid) as arguments,
       p.prosecdef,
       pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_own_account', 'delete_account');

select p.proname, n.nspname as schema
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'crypt' and n.nspname = 'extensions';

select pg_get_userbyid(p.proowner) as owner,
       has_table_privilege(pg_get_userbyid(p.proowner), 'auth.users', 'delete') as can_delete
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_own_account';

select p.proname, unnest(p.proacl)::text as granted_to
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_own_account', 'delete_account');

select u.id, u.email from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select p.id from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
