do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and cmd in ('UPDATE', 'INSERT', 'DELETE')
      and qual not like '%my_role()%'
      and qual not like '%auth.uid() = id%'
      and qual not like '%(select auth.uid()) = id%'
  ) then
    raise warning 'profiles has a write policy this file did not expect — check it before trusting the editor role boundary.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_guard_role'
  ) then
    raise exception 'profiles_guard_role is missing. Run supabase_admin_schema.sql first.';
  end if;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['diseases', 'articles', 'hospitals', 'emergency_contacts']
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      t, t || '_status_check'
    );
    execute format(
      'alter table public.%I add constraint %I check (status in (''draft'', ''pending'', ''published'', ''archived''))',
      t, t || '_status_check'
    );
  end loop;
end
$$;

comment on column public.diseases.status is
  'draft = being written, pending = awaiting review, published = live, archived = taken off the site but kept.';

do $$
declare
  t text;
begin
  foreach t in array array['diseases', 'articles', 'hospitals']
  loop
    execute format('drop policy if exists "Editors update their own %s" on public.%I', t, t);
    execute format('drop policy if exists "Editors update %s" on public.%I', t, t);
    execute format($p$
      create policy "Editors update %1$s"
        on public.%1$I for update to authenticated
        using ((select public.my_role()) in ('editor', 'admin'))
        with check ((select public.my_role()) in ('editor', 'admin'))
    $p$, t);
  end loop;
end
$$;

drop policy if exists "Admins update emergency contacts"  on public.emergency_contacts;
drop policy if exists "Editors update emergency contacts" on public.emergency_contacts;

create policy "Editors update emergency contacts"
  on public.emergency_contacts for update to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

drop policy if exists "Admins read every report" on public.reports;
drop policy if exists "Staff read every report"  on public.reports;

create policy "Staff read every report"
  on public.reports for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

drop policy if exists "Admins resolve reports" on public.reports;
drop policy if exists "Staff resolve reports"  on public.reports;

create policy "Staff resolve reports"
  on public.reports for update to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

drop policy if exists "Reporters read their own reports" on public.reports;
create policy "Reporters read their own reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

create table if not exists public.translations (
  en         text primary key,
  my         text,
  context    text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint translations_en_not_blank check (char_length(trim(en)) > 0)
);

comment on table public.translations is
  'Burmese overrides for the i18n keys in script.js. Keyed by the English source string, which is what the DOM walker matches on.';
comment on column public.translations.context is
  'Where this string appears, for a translator who cannot see the page. Not shown to readers.';

alter table public.translations enable row level security;

create or replace function public.stamp_translation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.en         := coalesce(old.en, new.en);   -- the key is immutable
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists translations_stamp on public.translations;
create trigger translations_stamp
  before insert or update on public.translations
  for each row execute function public.stamp_translation();

drop policy if exists "Anyone reads translations"      on public.translations;
drop policy if exists "Staff write translations"       on public.translations;
drop policy if exists "Staff update translations"      on public.translations;

create policy "Anyone reads translations"
  on public.translations for select to anon, authenticated
  using (true);

create policy "Staff write translations"
  on public.translations for insert to authenticated
  with check ((select public.my_role()) in ('editor', 'admin'));

create policy "Staff update translations"
  on public.translations for update to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

revoke update, insert, delete on public.translations from anon, authenticated;
grant insert (en, my, context) on public.translations to authenticated;
grant update (my, context)     on public.translations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone reads content images"   on storage.objects;
drop policy if exists "Staff upload content images"   on storage.objects;
drop policy if exists "Staff replace content images"  on storage.objects;

create policy "Anyone reads content images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'content-images');

create policy "Staff upload content images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'content-images'
    and (select public.my_role()) in ('editor', 'admin')
  );

create policy "Staff replace content images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'content-images'
    and (select public.my_role()) in ('editor', 'admin')
  )
  with check (
    bucket_id = 'content-images'
    and (select public.my_role()) in ('editor', 'admin')
  );

select table_name, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and privilege_type = 'UPDATE'
  and grantee = 'authenticated'
order by table_name, column_name;

select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (qual like '%editor%' or with_check like '%editor%')
order by tablename, cmd, policyname;

select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and cmd = 'DELETE'
  and (qual like '%editor%' or with_check like '%editor%');

select conrelid::regclass as on_table, pg_get_constraintdef(oid) as status_check
from pg_constraint
where conname like '%_status_check'
  and conrelid in ('public.diseases'::regclass, 'public.articles'::regclass,
                   'public.hospitals'::regclass, 'public.emergency_contacts'::regclass)
order by on_table;
