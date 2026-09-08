do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) then
    alter table public.profiles rename column username to display_name;
  end if;
end
$$;

alter table public.profiles
  add column if not exists display_name text;

comment on column public.profiles.display_name is
  'What the site calls this person instead of their email. Any characters, not unique, never used to sign in.';

drop index if exists public.profiles_username_lower_idx;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles drop constraint if exists profiles_display_name_format;

alter table public.profiles drop constraint if exists profiles_display_name_len;
alter table public.profiles
  add constraint profiles_display_name_len
  check (display_name is null or char_length(trim(display_name)) between 1 and 60);

drop function if exists public.username_available(text);

drop function if exists public.set_username(text);

create or replace function public.set_display_name(new_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  cleaned text := nullif(trim(new_name), '');
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;

  if cleaned is null then
    raise exception 'display_name_blank' using errcode = '22023';
  end if;

  if char_length(cleaned) > 60 then
    raise exception 'display_name_too_long' using errcode = '22001';
  end if;

  cleaned := trim(regexp_replace(cleaned, '[\n\r\t]+', ' ', 'g'));

  update public.profiles
     set display_name = cleaned
   where id = uid;

  return cleaned;
end;
$$;

comment on function public.set_display_name(text) is
  'Sets the calling user''s own display name. The only path by which a browser may write to profiles other than an admin changing a role.';

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_full_name text := nullif(trim(new.raw_user_meta_data ->> 'full_name'), '');
  meta_display   text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  if meta_full_name is not null then
    meta_full_name := left(meta_full_name, 80);
  end if;

  if meta_display is not null then
    meta_display := trim(left(regexp_replace(meta_display, '[\n\r\t]+', ' ', 'g'), 60));
    meta_display := nullif(meta_display, '');
  end if;

  insert into public.profiles as p (id, role, email, full_name, display_name)
  values (new.id, 'user', new.email, meta_full_name, meta_display)
  on conflict (id) do update
    set email        = excluded.email,
        full_name    = coalesce(excluded.full_name, p.full_name),
        display_name = coalesce(excluded.display_name, p.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role) on public.profiles to authenticated;

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('username', 'display_name');

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.profiles'::regclass
  and conname like 'profiles_display_name%';

select indexname from pg_indexes
where schemaname = 'public' and tablename = 'profiles'
  and indexname = 'profiles_username_lower_idx';

select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('set_display_name', 'set_username', 'username_available')
order by proname;

select email, display_name, full_name, role
from public.profiles
order by created_at;
