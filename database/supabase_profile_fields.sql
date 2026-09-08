alter table public.profiles
  add column if not exists full_name text,
  add column if not exists username  text;

comment on column public.profiles.full_name is
  'Display name as the person writes it. Supplied at signup, validated by the trigger.';
comment on column public.profiles.username is
  'Short handle the site calls them by. Unique, case-insensitively.';

alter table public.profiles drop constraint if exists profiles_full_name_len;
alter table public.profiles
  add constraint profiles_full_name_len
  check (full_name is null or char_length(trim(full_name)) between 2 and 80);

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[A-Za-z0-9._-]{3,24}$');

create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9._-]{3,24}$'
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = lower(candidate)
     );
$$;

comment on function public.username_available(text) is
  'True when the candidate is well-formed and unclaimed. Answers one question and reveals nothing else.';

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  meta_username  text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  if meta_full_name is not null and char_length(meta_full_name) > 80 then
    meta_full_name := left(meta_full_name, 80);
  end if;

  if meta_username is not null and meta_username !~ '^[A-Za-z0-9._-]{3,24}$' then
    raise exception 'username_invalid'
      using errcode = '22023',
            hint = '3 to 24 characters: letters, numbers, dots, dashes or underscores.';
  end if;

  insert into public.profiles as p (id, role, email, full_name, username)
  values (new.id, 'user', new.email, meta_full_name, meta_username)
  on conflict (id) do update
    set email     = excluded.email,
        full_name = coalesce(excluded.full_name, p.full_name),
        username  = coalesce(excluded.username,  p.username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role) on public.profiles to authenticated;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('full_name', 'username')
order by column_name;

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname in ('profiles_full_name_len', 'profiles_username_format');

select public.username_available('a_free_name')  as should_be_true,
       public.username_available('no')           as too_short,
       public.username_available('has spaces')   as bad_characters;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;

select email, username, full_name, role
from public.profiles
order by created_at;
