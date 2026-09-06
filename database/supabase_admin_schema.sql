-- ============================================================
-- MedCare — schema for the admin area
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER every existing supabase_*.sql file. Safe to re-run.
--
-- Four things happen here:
--   1. profiles gains `locale`, and a person may finally edit their own
--      row — with a trigger standing over the `role` column.
--   2. diseases gains the workflow columns, and so are born articles,
--      hospitals and emergency_contacts, each with RLS enabled in the
--      same statement block that creates it.
--   3. reports is migrated to the moderation schema: reporter_id,
--      target_type/target_id, detail, and open/resolved/dismissed.
--   4. Existing content is carried across from the JavaScript arrays it
--      lives in today, so nothing disappears from the public site.
--
-- WHAT IS DELIBERATELY ABSENT: any table recording what somebody
-- searched for or which disease page they opened. That is identifiable
-- health data. If a page-view counter is ever wanted it belongs in a
-- table with no user_id and no session id, and it is not in this file.
-- ============================================================


-- ============================================================
-- 1. PROFILES
-- ============================================================

alter table public.profiles
  add column if not exists locale text
    check (locale is null or locale in ('en', 'my'));

comment on column public.profiles.locale is
  'Preferred language, or null to follow the language switcher.';

/* ---------- The role guard ----------
   The brief asks that a person be able to update their own row while
   being unable to touch their own `role`, and that this be enforced in
   the database rather than by hiding a control.

   A column GRANT alone cannot do it: `role` has to stay updatable by
   SOMEBODY (admins), and column privileges are held by the whole
   `authenticated` role, not per person. So the rule lives in a trigger,
   which sees both the old row and the new one.

   It refuses two things:
     * anyone but an admin changing a role at all;
     * an admin changing their OWN role — the self-demotion the users
       page also disables, enforced here so deleting that JavaScript
       changes nothing.

   my_role() is SECURITY DEFINER and reads the caller's stored row, so
   it reports what the database believes, not what the request claims. */

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

  -- Columns nobody may rewrite from the browser, whatever the grants say.
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

-- Own-row editing, now that the trigger makes it safe.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Columns the browser may write. `role` stays here because admins need
-- it; the trigger is what stops everybody else using it.
revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role, display_name, full_name, locale) on public.profiles to authenticated;


-- ============================================================
-- 2. CONTENT WORKFLOW
-- ============================================================

/* Every content table carries the same four columns and the same
   trigger, so "who last touched this, and when" is answerable
   everywhere without remembering which table does it differently. */

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

-- Medical guidance has to say where it came from. NULL is allowed so
-- the rows that already exist are not invalidated on contact, but a URL
-- that IS given must be one of the two sources the project accepts.
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


-- ---------- 2a. diseases ----------

alter table public.diseases
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists status     text not null default 'draft',
  add column if not exists source_url text;

-- Everything that existed before this file is already on the site, so
-- it is published. New rows start as drafts.
--
-- `created_by is null` is what identifies a pre-migration row: the
-- stamp trigger fills that column on every write from now on. Using a
-- timestamp here instead would publish somebody's genuine draft the
-- second time this file was run.
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

-- Policies: replace the "staff may do anything" set with the three the
-- brief asks for — public sees published, editors own their own rows,
-- admins are unrestricted.
drop policy if exists "Anyone can read diseases"  on public.diseases;
drop policy if exists "Public can read diseases"  on public.diseases;
drop policy if exists "Staff can insert diseases" on public.diseases;
drop policy if exists "Staff can update diseases" on public.diseases;
drop policy if exists "Staff can delete diseases" on public.diseases;
-- ...and the names this file itself creates, so it can be run twice.
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


-- ---------- 2b. articles ----------
-- Columns mirror the objects in script.js: both languages inline,
-- because article prose is not translated through the dictionary.

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


-- ---------- 2c. hospitals ----------
-- Columns mirror the hospital objects in script.js. `er` is the
-- 24-hour emergency room flag the filter on hospitals.html uses.

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


-- ---------- 2d. emergency_contacts ----------
-- The highest-severity rows on the site: a wrong number here sends
-- somebody nowhere during an emergency. Admin-only for every write, and
-- no editor path at all.

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

-- NOTE — a deliberate departure from the brief, flagged for your call.
-- The brief says "Public SELECT" without qualification. This limits the
-- public to published rows, so a half-entered number cannot appear on
-- the emergency page while somebody is still typing it. Staff see every
-- row. Say the word and the `status = 'published'` clause comes off.
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


-- ============================================================
-- 3. REPORTS -> MODERATION QUEUE
-- ============================================================
-- Renames rather than recreates, so the reports already filed keep
-- their text, their author and their date.

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

-- `resolution_note` is a column the brief did not name. It is what the
-- Resolve and Dismiss actions write their required short note into;
-- `detail` belongs to the reporter. Say if you would rather they shared
-- one column.

-- new -> open, reviewed -> resolved. The constraint has to come off
-- before the values move, or the update fails against the old check.
alter table public.reports drop constraint if exists reports_status_check;
update public.reports set status = 'open'     where status = 'new';
update public.reports set status = 'resolved' where status = 'reviewed';
alter table public.reports alter column status set default 'open';
alter table public.reports
  add constraint reports_status_check
  check (status in ('open', 'resolved', 'dismissed'));

-- Who resolved it, and when, are recorded by the database rather than
-- sent by the browser: the one and the other cannot disagree.
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

-- Policies: file one as any signed-in reader, read and resolve as an
-- admin. See the note in the summary about what this takes away from
-- editors, which is a product decision rather than a schema one.
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

-- The two columns a resolver may write. resolved_by and resolved_at are
-- absent on purpose: the trigger sets them.
revoke update, delete on public.reports from anon, authenticated;
grant update (status, resolution_note) on public.reports to authenticated;


-- ============================================================
-- 4. CARRYING THE EXISTING CONTENT ACROSS
-- ============================================================
-- The four emergency numbers currently hard-coded into
-- emergency-contacts.html. They are inserted as PUBLISHED because they
-- are already live on the site — but they are also the rows most worth
-- checking against a source before you trust this migration.
--
-- source_url is left null deliberately: I have not verified these
-- against a WHO or Ministry of Health page, and writing a URL I have
-- not checked next to an ambulance number would be worse than leaving
-- it empty.

insert into public.emergency_contacts (name, sub, phone, icon, sort_order, status)
select v.name, v.sub, v.phone, v.icon, v.sort_order, 'published'
from (values
  ('Ambulance',      'Medical emergencies, serious injuries, and urgent hospital transport.', '192',       'bi-truck-front-fill',        1),
  ('Fire Services',  'Fires, gas leaks, building collapse, and rescue situations.',           '191',       'bi-fire',                    2),
  ('Police',         'Crime, violence, road accidents, and any situation needing police help.', '199',     'bi-shield-fill-check',       3),
  ('Poison Control', 'Swallowed chemicals, medicine overdose, snake bites, or food poisoning.', '01-256112', 'bi-exclamation-diamond-fill', 4)
) as v(name, sub, phone, icon, sort_order)
where not exists (select 1 from public.emergency_contacts e where e.phone = v.phone);

-- Hospitals and articles are migrated by their own scripts, generated
-- from the arrays in script.js so the text is copied rather than
-- retyped: supabase_seed_hospitals.sql and supabase_seed_articles.sql.
-- Those are the next files, and the pages keep reading their arrays
-- until the tables are populated and the readers are switched over.


-- ============================================================
-- 5. CHECKS
-- ============================================================

-- RLS must be on for all five content tables. Expect five true rows.
select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid in ('public.profiles'::regclass, 'public.diseases'::regclass,
              'public.articles'::regclass, 'public.hospitals'::regclass,
              'public.emergency_contacts'::regclass, 'public.reports'::regclass)
order by relname;

-- Every policy, per table, per operation.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'diseases', 'articles', 'hospitals',
                    'emergency_contacts', 'reports')
order by tablename, cmd, policyname;

-- The role guard is attached.
select tgname, tgrelid::regclass as on_table
from pg_trigger
where not tgisinternal
  and tgrelid in ('public.profiles'::regclass, 'public.reports'::regclass,
                  'public.diseases'::regclass, 'public.articles'::regclass,
                  'public.hospitals'::regclass, 'public.emergency_contacts'::regclass)
order by on_table, tgname;

-- Column privileges: the browser may write these and nothing else.
select table_name, grantee, column_name
from information_schema.column_privileges
where table_schema = 'public' and privilege_type = 'UPDATE'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, column_name;

-- Reports carried their statuses across (expect open/resolved only).
select status, count(*) from public.reports group by status order by status;

-- The emergency numbers, as the public will now read them.
select id, name, phone, status, updated_at from public.emergency_contacts order by sort_order;
