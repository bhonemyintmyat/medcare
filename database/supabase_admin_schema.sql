alter table public.profiles
  add column if not exists locale text
    check (locale is null or locale in ('en', 'my'));

comment on column public.profiles.locale is
  'Preferred language, or null to follow the language switcher.';

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    if (select public.my_role()) <> 'admin' then
      raise exception 'role_change_forbidden'
        using errcode = '42501',
              hint = 'Only an admin may change a role.';
    end if;

    if old.id = (select auth.uid()) then
      raise exception 'role_self_change_forbidden'
        using errcode = '42501',
              hint = 'An admin cannot change their own role. Ask another admin.';
    end if;
  end if;

  new.id         := old.id;
  new.email      := old.email;
  new.created_at := old.created_at;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role, display_name, full_name, locale) on public.profiles to authenticated;

create or replace function public.stamp_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  else
    new.created_by := old.created_by;   -- authorship is not transferable
  end if;

  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_approved_source(url text)
returns boolean
language sql
immutable
as $$
  select url is null
      or url ~* '^https://([a-z0-9-]+\.)*(who\.int|mohs\.gov\.mm|moh\.gov\.mm)(/|$)';
$$;

comment on function public.is_approved_source(text) is
  'True for WHO or Myanmar Ministry of Health URLs. Widen it here, in one place, if another source is ever approved.';

alter table public.diseases
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists status     text not null default 'draft',
  add column if not exists source_url text;

update public.diseases
   set status = 'published'
 where status = 'draft' and created_by is null;

alter table public.diseases drop constraint if exists diseases_status_check;
alter table public.diseases
  add constraint diseases_status_check
  check (status in ('draft', 'pending', 'published'));

alter table public.diseases drop constraint if exists diseases_source_url_check;
alter table public.diseases
  add constraint diseases_source_url_check
  check (public.is_approved_source(source_url));

drop trigger if exists diseases_stamp on public.diseases;
create trigger diseases_stamp
  before insert or update on public.diseases
  for each row execute function public.stamp_content();

create index if not exists diseases_status_idx on public.diseases (status);

drop policy if exists "Anyone can read diseases"  on public.diseases;
drop policy if exists "Public can read diseases"  on public.diseases;
drop policy if exists "Staff can insert diseases" on public.diseases;
drop policy if exists "Staff can update diseases" on public.diseases;
drop policy if exists "Staff can delete diseases" on public.diseases;

drop policy if exists "Public reads published diseases"   on public.diseases;
drop policy if exists "Staff read every disease"          on public.diseases;
drop policy if exists "Editors insert their own diseases" on public.diseases;
drop policy if exists "Editors update their own diseases" on public.diseases;
drop policy if exists "Admins delete diseases"            on public.diseases;

create policy "Public reads published diseases"
  on public.diseases for select to anon, authenticated
  using (status = 'published');

create policy "Staff read every disease"
  on public.diseases for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Editors insert their own diseases"
  on public.diseases for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

create policy "Editors update their own diseases"
  on public.diseases for update to authenticated
  using (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  )
  with check (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  );

create policy "Admins delete diseases"
  on public.diseases for delete to authenticated
  using ((select public.my_role()) = 'admin');

create table if not exists public.articles (
  id         bigint generated always as identity primary key,
  title      text not null,
  title_my   text,
  excerpt    text not null,
  excerpt_my text,
  cat        text not null,
  href       text not null unique,
  thumb      text,
  byline     text,
  byline_my  text,
  source_url text,
  status     text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_status_check check (status in ('draft', 'pending', 'published')),
  constraint articles_source_url_check check (public.is_approved_source(source_url))
);

alter table public.articles enable row level security;

create index if not exists articles_status_idx on public.articles (status);

drop trigger if exists articles_stamp on public.articles;
create trigger articles_stamp
  before insert or update on public.articles
  for each row execute function public.stamp_content();

drop policy if exists "Public reads published articles"   on public.articles;
drop policy if exists "Staff read every article"          on public.articles;
drop policy if exists "Editors insert their own articles" on public.articles;
drop policy if exists "Editors update their own articles" on public.articles;
drop policy if exists "Admins delete articles"            on public.articles;

create policy "Public reads published articles"
  on public.articles for select to anon, authenticated
  using (status = 'published');

create policy "Staff read every article"
  on public.articles for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Editors insert their own articles"
  on public.articles for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

create policy "Editors update their own articles"
  on public.articles for update to authenticated
  using (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  )
  with check (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  );

create policy "Admins delete articles"
  on public.articles for delete to authenticated
  using ((select public.my_role()) = 'admin');

create table if not exists public.hospitals (
  id         bigint generated always as identity primary key,
  name       text not null,
  type       text not null,
  township   text not null,
  address    text not null,
  phone      text,
  hours      text,
  er         boolean not null default false,
  status     text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospitals_status_check check (status in ('draft', 'pending', 'published')),
  constraint hospitals_type_check   check (type in ('general', 'specialist', 'clinic'))
);

alter table public.hospitals enable row level security;

create index if not exists hospitals_status_idx   on public.hospitals (status);
create index if not exists hospitals_township_idx on public.hospitals (township);

drop trigger if exists hospitals_stamp on public.hospitals;
create trigger hospitals_stamp
  before insert or update on public.hospitals
  for each row execute function public.stamp_content();

drop policy if exists "Public reads published hospitals"   on public.hospitals;
drop policy if exists "Staff read every hospital"          on public.hospitals;
drop policy if exists "Editors insert their own hospitals" on public.hospitals;
drop policy if exists "Editors update their own hospitals" on public.hospitals;
drop policy if exists "Admins delete hospitals"            on public.hospitals;

create policy "Public reads published hospitals"
  on public.hospitals for select to anon, authenticated
  using (status = 'published');

create policy "Staff read every hospital"
  on public.hospitals for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Editors insert their own hospitals"
  on public.hospitals for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

create policy "Editors update their own hospitals"
  on public.hospitals for update to authenticated
  using (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  )
  with check (
    (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'editor' and created_by = (select auth.uid()))
  );

create policy "Admins delete hospitals"
  on public.hospitals for delete to authenticated
  using ((select public.my_role()) = 'admin');

create table if not exists public.emergency_contacts (
  id         bigint generated always as identity primary key,
  name       text not null,
  sub        text,
  phone      text not null,
  icon       text,
  sort_order integer not null default 0,
  source_url text,
  status     text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint emergency_contacts_status_check check (status in ('draft', 'pending', 'published')),
  constraint emergency_contacts_source_check check (public.is_approved_source(source_url))
);

alter table public.emergency_contacts enable row level security;

create index if not exists emergency_contacts_order_idx on public.emergency_contacts (sort_order, id);

drop trigger if exists emergency_contacts_stamp on public.emergency_contacts;
create trigger emergency_contacts_stamp
  before insert or update on public.emergency_contacts
  for each row execute function public.stamp_content();

drop policy if exists "Public reads published emergency contacts" on public.emergency_contacts;
drop policy if exists "Staff read every emergency contact"        on public.emergency_contacts;
drop policy if exists "Admins insert emergency contacts"          on public.emergency_contacts;
drop policy if exists "Admins update emergency contacts"          on public.emergency_contacts;
drop policy if exists "Admins delete emergency contacts"          on public.emergency_contacts;

create policy "Public reads published emergency contacts"
  on public.emergency_contacts for select to anon, authenticated
  using (status = 'published');

create policy "Staff read every emergency contact"
  on public.emergency_contacts for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Admins insert emergency contacts"
  on public.emergency_contacts for insert to authenticated
  with check ((select public.my_role()) = 'admin');

create policy "Admins update emergency contacts"
  on public.emergency_contacts for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

create policy "Admins delete emergency contacts"
  on public.emergency_contacts for delete to authenticated
  using ((select public.my_role()) = 'admin');

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'reports' and column_name = 'user_id') then
    alter table public.reports rename column user_id to reporter_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'reports' and column_name = 'item_type') then
    alter table public.reports rename column item_type to target_type;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'reports' and column_name = 'item_id') then
    alter table public.reports rename column item_id to target_id;
  end if;
end
$$;

alter table public.reports
  add column if not exists detail          text,
  add column if not exists resolution_note text,
  add column if not exists resolved_by     uuid references public.profiles (id) on delete set null,
  add column if not exists resolved_at     timestamptz;

alter table public.reports drop constraint if exists reports_status_check;
update public.reports set status = 'open'     where status = 'new';
update public.reports set status = 'resolved' where status = 'reviewed';
alter table public.reports alter column status set default 'open';
alter table public.reports
  add constraint reports_status_check
  check (status in ('open', 'resolved', 'dismissed'));

create or replace function public.stamp_report_resolution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('resolved', 'dismissed') then
      new.resolved_by := (select auth.uid());
      new.resolved_at := now();
    else
      new.resolved_by := null;
      new.resolved_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reports_stamp_resolution on public.reports;
create trigger reports_stamp_resolution
  before update on public.reports
  for each row execute function public.stamp_report_resolution();

drop index if exists public.reports_user_idx;
drop index if exists public.reports_item_idx;
create index if not exists reports_reporter_idx      on public.reports (reporter_id);
create index if not exists reports_target_idx        on public.reports (target_type, target_id);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

drop policy if exists "Users can file their own reports" on public.reports;
drop policy if exists "Users can read their own reports" on public.reports;
drop policy if exists "Staff can read all reports"       on public.reports;
drop policy if exists "Staff can update report status"   on public.reports;
drop policy if exists "Anyone signed in files a report"  on public.reports;
drop policy if exists "Admins read every report"         on public.reports;
drop policy if exists "Admins resolve reports"           on public.reports;

create policy "Anyone signed in files a report"
  on public.reports for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
  );

create policy "Admins read every report"
  on public.reports for select to authenticated
  using ((select public.my_role()) = 'admin');

create policy "Admins resolve reports"
  on public.reports for update to authenticated
  using ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

revoke update, delete on public.reports from anon, authenticated;
grant update (status, resolution_note) on public.reports to authenticated;

insert into public.emergency_contacts (name, sub, phone, icon, sort_order, status)
select v.name, v.sub, v.phone, v.icon, v.sort_order, 'published'
from (values
  ('Ambulance',      'Medical emergencies, serious injuries, and urgent hospital transport.', '192',       'bi-truck-front-fill',        1),
  ('Fire Services',  'Fires, gas leaks, building collapse, and rescue situations.',           '191',       'bi-fire',                    2),
  ('Police',         'Crime, violence, road accidents, and any situation needing police help.', '199',     'bi-shield-fill-check',       3),
  ('Poison Control', 'Swallowed chemicals, medicine overdose, snake bites, or food poisoning.', '01-256112', 'bi-exclamation-diamond-fill', 4)
) as v(name, sub, phone, icon, sort_order)
where not exists (select 1 from public.emergency_contacts e where e.phone = v.phone);

select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid in ('public.profiles'::regclass, 'public.diseases'::regclass,
              'public.articles'::regclass, 'public.hospitals'::regclass,
              'public.emergency_contacts'::regclass, 'public.reports'::regclass)
order by relname;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'diseases', 'articles', 'hospitals',
                    'emergency_contacts', 'reports')
order by tablename, cmd, policyname;

select tgname, tgrelid::regclass as on_table
from pg_trigger
where not tgisinternal
  and tgrelid in ('public.profiles'::regclass, 'public.reports'::regclass,
                  'public.diseases'::regclass, 'public.articles'::regclass,
                  'public.hospitals'::regclass, 'public.emergency_contacts'::regclass)
order by on_table, tgname;

select table_name, grantee, column_name
from information_schema.column_privileges
where table_schema = 'public' and privilege_type = 'UPDATE'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, column_name;

select status, count(*) from public.reports group by status order by status;

select id, name, phone, status, updated_at from public.emergency_contacts order by sort_order;
