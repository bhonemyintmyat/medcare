-- ============================================================
-- MedCare — what the editor area needs from the database
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql. Safe to re-run.
--
-- The editor UI in medcare/editor/ was written to the brief:
--
--   * create and edit diseases and articles (draft -> pending -> published)
--   * update hospital records and emergency contact numbers
--   * upload/replace images, fill in translations for existing i18n keys
--   * triage the report queue: view, resolve, reject
--   * soft-delete (unpublish) content, but not hard-delete
--   * cannot touch user accounts or roles
--
-- Four of those are refused by the schema as it stands today, so the
-- screens would load and every write would come back 403. This file is
-- what closes the gap. It is written in five INDEPENDENT sections —
-- run the ones you agree with and skip the ones you do not. Each says
-- what it widens and what it deliberately leaves shut.
--
-- Nothing here gives an editor a single new privilege over `profiles`.
-- That is the one line the brief draws, and it is drawn in section 0.
-- ============================================================


-- ============================================================
-- 0. THE LINE THAT IS NOT MOVED
-- ============================================================
-- Stated as an assertion rather than a change, so that re-running this
-- file after somebody has edited a policy tells you it has moved.
--
-- `profiles` has exactly one non-admin write path: set_display_name(),
-- which takes the account from the verified token and touches only
-- display_name. The guard_profile_role trigger refuses every role
-- change that is not made by an admin on somebody else's row.
--
-- The editor UI never queries profiles for anything but names to print.

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


-- ============================================================
-- 1. ARCHIVED: WHAT "SOFT-DELETE" ACTUALLY MEANS
-- ============================================================
-- The brief asks for soft-delete, and the obvious implementation is to
-- push the row back to 'draft'. That is wrong in a way that only shows
-- up months later: a draft is something on its way ONTO the site, and
-- an unpublished page is something that has been taken OFF it. Collapse
-- the two and the drafts list fills with retired pages nobody will ever
-- finish, and "why did this disappear?" has no answer in the row.
--
-- So there is a fourth status. Public pages already filter on
-- status = 'published', so archived rows leave the site the moment they
-- are set, with no change to any reader-facing query.
--
-- Editors still have no DELETE policy anywhere. Hard-delete stays with
-- admins, which is what the brief asks for.

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


-- ============================================================
-- 2. EDITORS EDIT THE SITE, NOT ONLY THEIR OWN ROWS
-- ============================================================
-- SKIP THIS SECTION IF YOU DISAGREE — it is the widest change here.
--
-- Today an editor may update only rows where created_by = auth.uid().
-- On a team that means a typo in a colleague's disease page cannot be
-- fixed by the person who spotted it, and an editor who leaves takes
-- their pages with them. The brief's "update hospital records" is
-- flatly stated and reads as the whole table.
--
-- What this does NOT do: it does not touch `created_by`. The stamp
-- trigger still refuses to transfer authorship, so "who wrote this"
-- survives everybody editing everything, and updated_by records who
-- touched it last. Accountability comes from the stamp, not from
-- locking the row.

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


-- ============================================================
-- 3. EMERGENCY CONTACTS: EDITORS MAY UPDATE, NOT CREATE OR DELETE
-- ============================================================
-- The brief says editors update emergency contact numbers. The admin
-- schema made this table admin-only, and said why: a wrong number here
-- is the worst thing this site can print.
--
-- The middle position, which is what the UI was built against: an
-- editor may CORRECT an existing number, because that is the change
-- that has to happen fast when a hospital switches lines. Adding a new
-- emergency service, and removing one, stay with admins — those are the
-- changes that alter what the emergency page IS, and they are never
-- urgent in the same way.
--
-- editor/emergency.html makes the editor type a changed number twice
-- and shows a live tel: preview. That is a UI convention, not a
-- control; the reason the column is safe to open is that the row cannot
-- be created or destroyed from here, only corrected, and every
-- correction is stamped with who made it.

drop policy if exists "Admins update emergency contacts"  on public.emergency_contacts;
drop policy if exists "Editors update emergency contacts" on public.emergency_contacts;

create policy "Editors update emergency contacts"
  on public.emergency_contacts for update to authenticated
  using ((select public.my_role()) in ('editor', 'admin'))
  with check ((select public.my_role()) in ('editor', 'admin'));

-- Insert and delete are untouched above and remain admin-only.
--
-- SUPERSEDED IN PART. The reasoning above assumed admins had an
-- emergency screen to add a service from. They no longer do, so
-- supabase_admin_scope.sql moves INSERT here as well and explains why —
-- INSERT reserved to a role with no UI is not a safeguard, it is a table
-- nobody can add a row to. What holds a new number back instead is the
-- workflow: it is born 'draft' and the public policy serves only
-- 'published'. DELETE stays admin-only in both files.


-- ============================================================
-- 4. THE REPORT QUEUE
-- ============================================================
-- The admin schema restricted reports to admins. The brief puts triage
-- with the editor, which is the arrangement that makes sense: a report
-- is nearly always "this page is wrong", and the person who can fix the
-- page is the person who should read it.
--
-- Editors get SELECT and the same two-column UPDATE grant admins have.
-- resolved_by and resolved_at stay out of the grant — the trigger sets
-- them from the verified token, so the record of who cleared a report
-- cannot be typed in by the browser.
--
-- Still no DELETE policy for anybody but the table owner. A report is
-- somebody telling us we published something wrong; it does not get
-- to be made to disappear from a UI.

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

-- The reporter keeps sight of what they filed. Without this a reader
-- files a report and it vanishes, which is how you teach people not to
-- bother filing them.
drop policy if exists "Reporters read their own reports" on public.reports;
create policy "Reporters read their own reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- The brief's "rejected" is this table's 'dismissed'. The UI prints
-- "Reject" because that is the word the brief uses; the column keeps
-- 'dismissed' because renaming a live status value to gain a synonym is
-- a migration that buys nothing.


-- ============================================================
-- 5. TRANSLATIONS
-- ============================================================
-- Today the Burmese dictionary is an object literal in script.js, keyed
-- by the exact English string on the page. It works, and it means an
-- editor cannot fix a translation without a developer editing a .js
-- file and redeploying — which is the thing the brief is asking to end.
--
-- This table is that dictionary, in the database, with the SAME key: the
-- English source string. script.js keeps its literal as the fallback and
-- layers this table over the top, so a row here wins and a key with no
-- row here still translates from the file. Nothing regresses if this
-- table is empty, and nothing regresses if it is unreachable.
--
-- `en` is the key and is never edited from the editor UI — changing it
-- would silently orphan the translation, because the key is what the
-- page text is matched against. Editors fill in and correct `my`.

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

-- Read is public: every visitor's page needs it, signed in or not.
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

-- No delete policy. A key is removed by removing it from script.js,
-- where it lives; deleting the row would only drop back to the file.

revoke update, insert, delete on public.translations from anon, authenticated;
grant insert (en, my, context) on public.translations to authenticated;
grant update (my, context)     on public.translations to authenticated;


-- ============================================================
-- 6. IMAGES
-- ============================================================
-- editor/media.html uploads into a Storage bucket rather than writing
-- base64 into a text column. Public read, staff write, no delete from
-- the browser — replacing an image is an upsert to the same path, so
-- the page that references it keeps working and there is never a moment
-- where the site points at a file that is gone.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', true, 3145728,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3 MB and four formats: the limit is enforced here as well as in the
-- browser, because the browser check is a courtesy and this one is not.

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

-- No delete policy: an image is replaced, never removed, for the reason
-- above. Clearing out orphans is an admin job done from the dashboard.


-- ============================================================
-- 7. CHECKS
-- ============================================================

-- What an editor may now write. profiles must NOT appear in this list
-- with anything but display_name/full_name/locale/role — and `role` is
-- there only because the trigger stops everyone but admins using it.
select table_name, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and privilege_type = 'UPDATE'
  and grantee = 'authenticated'
order by table_name, column_name;

-- Every policy that now mentions the editor role.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (qual like '%editor%' or with_check like '%editor%')
order by tablename, cmd, policyname;

-- Editors must have no DELETE anywhere. Expect zero rows.
select tablename, policyname, qual
from pg_policies
where schemaname = 'public' and cmd = 'DELETE'
  and (qual like '%editor%' or with_check like '%editor%');

-- The four content tables accept 'archived'.
select conrelid::regclass as on_table, pg_get_constraintdef(oid) as status_check
from pg_constraint
where conname like '%_status_check'
  and conrelid in ('public.diseases'::regclass, 'public.articles'::regclass,
                   'public.hospitals'::regclass, 'public.emergency_contacts'::regclass)
order by on_table;
