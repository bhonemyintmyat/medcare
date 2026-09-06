-- ============================================================
-- MedCare — `pharmacies`
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql, supabase_editor.sql and
-- supabase_publish_approval.sql. Safe to re-run.
--
-- The editor area gained a fourth kind of content. pharmacy.html was a
-- hard-coded list in script.js with no row behind it, so an editor who
-- found a wrong phone number on it could do nothing about it. This is
-- the table that ends that, and it is deliberately the hospitals table
-- with two columns swapped — same statuses, same policies, same
-- triggers, so this site has one content workflow rather than one per
-- screen.
--
-- WHAT IS DIFFERENT FROM hospitals
--
--   * `type` is chain | independent | hospital | clinic. The first two
--     stand alone; the last two are attached to a medical facility, and
--     pharmacy.html offers them as a single filter while the column keeps
--     them apart so a card can say which it is.
--   * `er` becomes two flags, `open24` and `delivery`, which are the two
--     service tickboxes on that page.
--
-- Everything else — the four statuses, who may write, who may publish,
-- what anon may do — is copied rather than reinvented, and section 5
-- asserts that it really did come out the same.
-- ============================================================


-- ============================================================
-- 0. THE PIECES THIS FILE BUILDS ON
-- ============================================================
-- Fail loudly and early rather than half-create a table whose guard
-- trigger silently does not exist. A pharmacy row an editor can publish
-- without review is not a smaller version of this feature; it is a hole
-- in the approval rule the rest of the site is built on.

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


-- ============================================================
-- 1. THE TABLE
-- ============================================================
-- Columns mirror the pharmacy objects in script.js, which is where this
-- list has been living. 'archived' is in the status check from the
-- start: supabase_editor.sql section 1 adds it to the four older tables,
-- and a table created afterwards should not need that migration re-run.

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

-- A table that exists before its RLS is on is readable and writable by
-- anyone holding the anon key for as long as this script takes to reach
-- the next line. Enabled immediately, as everywhere else.
alter table public.pharmacies enable row level security;

create index if not exists pharmacies_status_idx   on public.pharmacies (status);
create index if not exists pharmacies_township_idx on public.pharmacies (township);

drop trigger if exists pharmacies_stamp on public.pharmacies;
create trigger pharmacies_stamp
  before insert or update on public.pharmacies
  for each row execute function public.stamp_content();

-- Created here, switched off for the length of the seed in section 4,
-- and switched back on immediately after. The note there says why.
drop trigger if exists pharmacies_guard_publish on public.pharmacies;
create trigger pharmacies_guard_publish
  before insert or update on public.pharmacies
  for each row execute function public.guard_publish();


-- ============================================================
-- 2. WHO MAY DO WHAT
-- ============================================================
-- The hospitals policies as supabase_editor.sql section 2 leaves them:
-- staff update the whole table, not only rows they created, because a
-- wrong phone number should be fixable by whoever spotted it.
-- `created_by` still records who wrote it and the stamp trigger refuses
-- to transfer that, so accountability comes from the stamp rather than
-- from locking the row.
--
-- No DELETE policy for editors, here or anywhere. Taking a pharmacy off
-- the site is `archived`; hard-delete stays with admins.

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

-- Supabase hands `anon` table-level INSERT/UPDATE/DELETE on every new
-- table. RLS already refuses them, but a grant nobody meant to give is
-- one policy edit away from being real. Same revoke every other content
-- table carries — see supabase_revoke_anon_writes.sql.
revoke insert, update, delete on public.pharmacies from anon;


-- ============================================================
-- 3. THE PENDING QUEUE KNOWS ABOUT THEM
-- ============================================================
-- pending_review is what a psql session or a scheduled "what is waiting"
-- mail reads. A kind of content missing from it is a queue that quietly
-- under-reports, which is worse than not having the view at all.
-- Same columns as before, so `create or replace` is enough.

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


-- ============================================================
-- 4. THE ROWS pharmacy.html HAS BEEN SHOWING
-- ============================================================
-- Carried across from the `pharmacies` array in script.js, which is the
-- list readers see today. They arrive 'published' for the same reason
-- the hospitals seed does: they are already on the site, and importing
-- them as drafts would take a working page down.
--
-- Re-runnable: name plus township identifies one, since a chain has
-- branches in more than one township.
--
-- WHY THE GUARD COMES OFF FOR THIS
--
-- guard_publish() asks my_role() who is writing, and my_role() reads the
-- caller's profile row. Run from the SQL editor there is no caller —
-- auth.uid() is null, the role comes back null, and the trigger refuses
-- these ten inserts as an unapproved publish. It is right to: an insert
-- landing at 'published' is exactly what it exists to stop.
--
-- So the guard is switched off for the length of the seed rather than
-- worked around. `disable trigger` takes an exclusive lock on the table,
-- which means there is no window in which somebody else's write slips
-- through unguarded — the alternative, creating the trigger afterwards,
-- leaves one. The hospitals seed had this for free: it ran before
-- supabase_publish_approval.sql existed.

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

-- Publishing is an admin act here as it is everywhere else. Without this
-- an editor could put a pharmacy in front of readers with no review,
-- which is precisely the rule supabase_publish_approval.sql states.
-- Re-enable is not conditional on the insert above having done anything:
-- if this line does not run, the table is left unguarded.
alter table public.pharmacies enable trigger pharmacies_guard_publish;


-- ============================================================
-- 5. CHECKS
-- ============================================================

-- Expect 10 rows, all published, 4 open around the clock, 4 delivering.
select count(*) as total,
       count(*) filter (where status = 'published') as published,
       count(*) filter (where open24)   as open_24h,
       count(*) filter (where delivery) as delivering
from public.pharmacies;

-- The types in use, which must all satisfy pharmacies_type_check.
select type, count(*) from public.pharmacies group by type order by type;

-- The policies on this table beside the ones on hospitals. The two
-- lists should differ only in the noun.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename in ('hospitals', 'pharmacies')
order by cmd, tablename, policyname;

-- Both triggers present. Without guard_publish, an editor can publish.
select tgname from pg_trigger
where tgrelid = 'public.pharmacies'::regclass and not tgisinternal
order by tgname;

-- Editors must have no DELETE here. Expect zero rows.
select policyname, qual from pg_policies
where schemaname = 'public' and tablename = 'pharmacies' and cmd = 'DELETE'
  and (qual like '%editor%' or with_check like '%editor%');

-- anon must hold SELECT and nothing else.
select privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'pharmacies' and grantee = 'anon'
order by privilege_type;

-- What is waiting for an admin, pharmacies included.
select kind, count(*) from public.pending_review group by kind order by kind;
