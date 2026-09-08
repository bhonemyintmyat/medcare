drop policy if exists "Admins insert emergency contacts"            on public.emergency_contacts;
drop policy if exists "Editors insert emergency contacts"           on public.emergency_contacts;
drop policy if exists "Editors insert their own emergency contacts" on public.emergency_contacts;

create policy "Editors insert emergency contacts"
  on public.emergency_contacts for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_key_not_blank check (char_length(trim(key)) > 0)
);

comment on table public.site_settings is
  'Operational settings for the site itself. Never health content: no row here says anything a reader would act on medically.';

comment on column public.site_settings.value is
  'Plain text and booleans only. Anything rendered from here goes through textContent, never innerHTML — an admin typing into a form is not a reason to trust the string.';

alter table public.site_settings enable row level security;

create or replace function public.stamp_site_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.key        := coalesce(old.key, new.key);   -- the key is immutable
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_settings_stamp on public.site_settings;
create trigger site_settings_stamp
  before insert or update on public.site_settings
  for each row execute function public.stamp_site_setting();

drop policy if exists "Anyone reads site settings"  on public.site_settings;
drop policy if exists "Admins write site settings"  on public.site_settings;
drop policy if exists "Admins change site settings" on public.site_settings;

create policy "Anyone reads site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

create policy "Admins write site settings"
  on public.site_settings for insert to authenticated
  with check ((select public.my_role()) = 'admin');

create policy "Admins change site settings"
  on public.site_settings for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

revoke insert, update, delete on public.site_settings from anon;
revoke update on public.site_settings from authenticated;
grant  update (value) on public.site_settings to authenticated;

insert into public.site_settings (key, value) values

  ('maintenance', jsonb_build_object(
     'enabled',         false,
     'message',         'MedCare is being updated. Please check back shortly.',
     'allow_emergency', true
   )),

  ('notice', jsonb_build_object(
     'enabled', false,
     'tone',    'info',
     'text',    ''
   )),

  ('legal.terms',    jsonb_build_object('title', 'Terms of use', 'body', '')),
  ('legal.privacy',  jsonb_build_object('title', 'Privacy',      'body', '')),
  ('legal.cookies',  jsonb_build_object('title', 'Cookies',      'body', '')),
  ('footer.contact', jsonb_build_object('email', '', 'phone', '', 'address', ''))

on conflict (key) do nothing;

select policyname, cmd, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'emergency_contacts'
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
order by cmd, policyname;

select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;

select key, value, updated_at, updated_by is not null as touched_by_a_person
from public.site_settings
order by key;

