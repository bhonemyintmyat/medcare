do $$
begin
  if to_regprocedure('public.stamp_content()') is null then
    raise exception 'stamp_content() is missing. Run supabase_admin_schema.sql first.';
  end if;
  if to_regprocedure('public.guard_publish()') is null then
    raise exception 'guard_publish() is missing. Run supabase_publish_approval.sql first.';
  end if;
end
$$;

create table if not exists public.pharmacies (
  id         bigint generated always as identity primary key,
  name       text not null,
  type       text not null,
  township   text not null,
  address    text not null,
  phone      text,
  hours      text,
  open24     boolean not null default false,
  delivery   boolean not null default false,
  status     text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pharmacies_status_check check (status in ('draft', 'pending', 'published', 'archived')),
  constraint pharmacies_type_check   check (type in ('chain', 'independent', 'hospital', 'clinic'))
);

comment on table public.pharmacies is
  'The pharmacy directory behind pharmacy.html. Same workflow as hospitals.';
comment on column public.pharmacies.status is
  'draft = being written, pending = awaiting review, published = live, archived = taken off the site but kept.';
comment on column public.pharmacies.open24 is
  'The "Open 24 hours" filter on pharmacy.html.';
comment on column public.pharmacies.delivery is
  'The "Home delivery" filter on pharmacy.html.';

alter table public.pharmacies enable row level security;

create index if not exists pharmacies_status_idx   on public.pharmacies (status);
create index if not exists pharmacies_township_idx on public.pharmacies (township);

drop trigger if exists pharmacies_stamp on public.pharmacies;
create trigger pharmacies_stamp
  before insert or update on public.pharmacies
  for each row execute function public.stamp_content();

drop trigger if exists pharmacies_guard_publish on public.pharmacies;
create trigger pharmacies_guard_publish
  before insert or update on public.pharmacies
  for each row execute function public.guard_publish();

drop policy if exists "Public reads published pharmacies"   on public.pharmacies;
drop policy if exists "Staff read every pharmacy"           on public.pharmacies;
drop policy if exists "Editors insert their own pharmacies" on public.pharmacies;
drop policy if exists "Editors update their own pharmacies" on public.pharmacies;
drop policy if exists "Editors update pharmacies"           on public.pharmacies;
drop policy if exists "Admins delete pharmacies"            on public.pharmacies;

create policy "Public reads published pharmacies"
  on public.pharmacies for select to anon, authenticated
  using (status = 'published');

create policy "Staff read every pharmacy"
  on public.pharmacies for select to authenticated
  using ((select public.my_role()) in ('editor', 'admin'));

create policy "Editors insert their own pharmacies"
  on public.pharmacies for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

create policy "Editors update pharmacies"
  on public.pharmacies for update to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

create policy "Admins delete pharmacies"
  on public.pharmacies for delete to authenticated
  using ((select public.my_role()) = 'admin');

revoke insert, update, delete on public.pharmacies from anon;

create or replace view public.pending_review as
  select 'disease'::text as kind, id, name  as title, updated_at, updated_by from public.diseases            where status = 'pending'
  union all
  select 'article'::text,          id, title,          updated_at, updated_by from public.articles           where status = 'pending'
  union all
  select 'hospital'::text,         id, name,           updated_at, updated_by from public.hospitals          where status = 'pending'
  union all
  select 'pharmacy'::text,         id, name,           updated_at, updated_by from public.pharmacies         where status = 'pending'
  union all
  select 'emergency'::text,        id, name,           updated_at, updated_by from public.emergency_contacts where status = 'pending';

alter view public.pending_review set (security_invoker = on);
grant select on public.pending_review to authenticated;

alter table public.pharmacies disable trigger pharmacies_guard_publish;

insert into public.pharmacies (name, type, township, address, phone, hours, open24, delivery, status)
select v.name, v.type, v.township, v.address, v.phone, v.hours, v.open24, v.delivery, 'published'
from (values
  ('City Mart Pharmacy — Junction City', 'chain',       'Pabedan',        'Junction City, Bogyoke Aung San Rd',    '01-9253000', 'Daily, 9:00–21:00', false, true),
  ('AA Pharmacy',                        'independent', 'Latha',          'Maha Bandula Rd, Latha',                '01-386455',  'Open 24 hours',     true,  false),
  ('Yangon General Hospital Pharmacy',   'hospital',    'Latha',          'Bogyoke Aung San Rd, Latha',            '01-256112',  'Open 24 hours',     true,  false),
  ('Ocean Pharmacy — Kamayut',           'chain',       'Kamayut',        'Pyay Rd, Kamayut',                      '01-9666300', 'Daily, 8:00–22:00', false, true),
  ('Shwe Pyi Tagon Drug Store',          'independent', 'Sanchaung',      'Baho Rd, Sanchaung',                    '01-524378',  'Daily, 8:00–21:00', false, false),
  ('Pun Hlaing Hospital Pharmacy',       'hospital',    'Hlaing Tharyar', 'Pun Hlaing Estate Ave, Hlaing Tharyar', '01-3684323', 'Open 24 hours',     true,  false),
  ('Gandamar Pharmacy',                  'chain',       'Bahan',          'Kabar Aye Pagoda Rd, Bahan',            '01-546712',  'Daily, 9:00–22:00', false, true),
  ('May Pharmacy',                       'independent', 'Yankin',         'Sayarsan Rd, Yankin',                   '01-578221',  'Daily, 8:30–20:30', false, false),
  ('Sein Gay Har Pharmacy',              'chain',       'Dagon',          'Pyay Rd, Dagon',                        '01-379155',  'Open 24 hours',     true,  true),
  ('Thukha Drug Store',                  'independent', 'Mayangone',      'Insein Rd, Mayangone',                  '01-9669042', 'Daily, 8:00–20:00', false, false)
) as v(name, type, township, address, phone, hours, open24, delivery)
where not exists (
  select 1 from public.pharmacies p
  where p.name = v.name and p.township = v.township
);

alter table public.pharmacies enable trigger pharmacies_guard_publish;

select count(*) as total,
       count(*) filter (where status = 'published') as published,
       count(*) filter (where open24)   as open_24h,
       count(*) filter (where delivery) as delivering
from public.pharmacies;

select type, count(*) from public.pharmacies group by type order by type;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('hospitals', 'pharmacies')
order by cmd, tablename, policyname;

select tgname from pg_trigger
where tgrelid = 'public.pharmacies'::regclass and not tgisinternal
order by tgname;

select policyname, qual from pg_policies
where schemaname = 'public' and tablename = 'pharmacies' and cmd = 'DELETE'
  and (qual like '%editor%' or with_check like '%editor%');

select privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'pharmacies' and grantee = 'anon'
order by privilege_type;

select kind, count(*) from public.pending_review group by kind order by kind;
