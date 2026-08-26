-- ============================================================
-- MedCare — narrow the admin to the site, and close the gap that leaves
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_schema.sql AND supabase_editor.sql.
-- Safe to re-run.
--
-- THE CHANGE OF REMIT. The admin area now covers user management, site
-- maintenance and permission control, and nothing else. Health content —
-- diseases, articles, hospitals, emergency numbers, images, translations,
-- and the reader reports about them — belongs to the editor area.
--
-- That line is drawn because the two jobs need different qualifications.
-- Resetting a password, granting a role and putting the site behind a
-- maintenance page are operational acts. Changing what a page says about
-- treating dengue is a clinical one. Somebody trusted with the first is
-- not, by that fact, trusted with the second.
--
-- MOST OF THIS WORK IS ALREADY DONE, in supabase_editor.sql:
--   section 2  editors update diseases, articles and hospitals
--   section 3  editors correct emergency contact numbers
--   section 4  editors read and resolve the report queue
--   section 5  editors write translations
--   section 6  editors upload images
-- None of that is repeated here. This file adds only the two things the
-- change of remit leaves outstanding.
--
-- WHAT NEEDS NO SCHEMA AT ALL: the housekeeping screen. Orphaned
-- accounts, content with no owner, and source URLs that fail
-- is_approved_source() are all questions about rows an admin can already
-- read. It is a page of queries, not a table.
-- ============================================================


-- ============================================================
-- 1. WHO CREATES A NEW EMERGENCY SERVICE
-- ============================================================
/* supabase_editor.sql section 3 took the middle position: an editor may
   CORRECT an emergency number, while creating and removing a service
   stayed with admins, because those change what the emergency page IS.

   That reasoning held while admins had an emergency screen. They no
   longer do, and the position has to be revisited rather than inherited:
   INSERT admin-only plus no admin UI is not a safeguard, it is a table
   that nobody on the site can add a row to.

   So INSERT follows the correction right into the editor area. What
   replaces the role gate is the workflow already on the table: a row is
   born 'draft', the public policy serves only 'published', and a
   half-typed number is invisible until somebody deliberately publishes
   it. editor/emergency.html's type-it-twice field applies to a new row
   as much as to a corrected one.

   Worth stating plainly, because it is a real reduction: this is one
   pair of hands, not two. Nothing here stops the editor who typed a
   number from publishing it. If that is not acceptable, the fix is an
   approval step on the 'pending' status that the check constraint
   already allows — say so and it goes in as its own migration.

   DELETE is deliberately NOT moved. It stays admin-only, alongside
   hard-delete on every other content table: removing a row is
   janitorial, it is never urgent, and supabase_editor.sql's rule that
   editors hold no DELETE policy anywhere stays true. */

drop policy if exists "Admins insert emergency contacts"            on public.emergency_contacts;
drop policy if exists "Editors insert emergency contacts"           on public.emergency_contacts;
drop policy if exists "Editors insert their own emergency contacts" on public.emergency_contacts;

create policy "Editors insert emergency contacts"
  on public.emergency_contacts for insert to authenticated
  with check (
    (select public.my_role()) in ('editor', 'admin')
    and created_by = (select auth.uid())
  );

-- "Public reads published emergency contacts", "Staff read every
-- emergency contact", "Editors update emergency contacts" (from
-- supabase_editor.sql) and "Admins delete emergency contacts" are all
-- left exactly as they are.


-- ============================================================
-- 2. SITE SETTINGS
-- ============================================================
/* What the admin area maintains instead of content: maintenance mode,
   the site-wide notice, and the legal and footer text.

   One key/value row per setting rather than one wide singleton row.
   Reason: the public site reads two of these on every page load
   (maintenance, notice) and should not be handed the legal text and the
   footer contact details to get them.

   value is jsonb so a setting can grow a field without a migration.
   Every consumer must treat a missing key as "off" — the site has to
   work against an empty table, which is what a fresh clone has. */

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

/* World-readable, including anon. A visitor who is not signed in is
   exactly the visitor who needs to be told the site is closed. */
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

/* No DELETE policy for anybody. A setting is turned off, not removed:
   a missing key and a key set to false have to mean the same thing to
   the public site anyway, and keeping the row keeps the audit stamp of
   who turned it off. */

-- Same reasoning as supabase_revoke_anon_writes.sql: refuse an
-- anonymous write at the privilege check, loudly, before RLS is asked.
revoke insert, update, delete on public.site_settings from anon;
revoke update on public.site_settings from authenticated;
grant  update (value) on public.site_settings to authenticated;


-- ---------- 2a. The keys the admin screens expect ----------
/* Seeded so the pages have something to render, and so the key names
   live in one place rather than being invented by whichever page is
   written first. `on conflict do nothing`: re-running this file must not
   turn maintenance mode off under somebody who has just turned it on. */

insert into public.site_settings (key, value) values

  -- Maintenance mode. `allow_emergency` keeps emergency-contacts.html
  -- served while the rest of the site is closed. A site that hides the
  -- ambulance number in order to install an update has failed at the one
  -- thing it exists for, so the default is true and the maintenance
  -- screen should make turning it off deliberate.
  ('maintenance', jsonb_build_object(
     'enabled',         false,
     'message',         'MedCare is being updated. Please check back shortly.',
     'allow_emergency', true
   )),

  -- The site-wide banner: a strip of text on top of the pages. Not an
  -- alert system, and nothing about it is medical.
  ('notice', jsonb_build_object(
     'enabled', false,
     'tone',    'info',        -- info | warning
     'text',    ''
   )),

  -- Legal and footer text. Plain text, rendered as text.
  ('legal.terms',    jsonb_build_object('title', 'Terms of use', 'body', '')),
  ('legal.privacy',  jsonb_build_object('title', 'Privacy',      'body', '')),
  ('legal.cookies',  jsonb_build_object('title', 'Cookies',      'body', '')),
  ('footer.contact', jsonb_build_object('email', '', 'phone', '', 'address', ''))

on conflict (key) do nothing;


-- ============================================================
-- 3. CHECKS
-- ============================================================

-- Every write policy on emergency_contacts, and the role each one
-- names. Expect: editor+admin on INSERT and UPDATE, admin alone on
-- DELETE.
select policyname, cmd, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'emergency_contacts'
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
order by cmd, policyname;

-- site_settings: readable by everyone, writable by admins, deletable by
-- nobody. Expect no DELETE row at all.
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;

-- The seeded keys, and whether anybody has changed one yet.
select key, value, updated_at, updated_by is not null as touched_by_a_person
from public.site_settings
order by key;


-- ============================================================
-- WHERE EACH ROLE NOW STANDS
-- ============================================================
--   user    reads published content; files a report and can see it
--           afterwards; edits their own display name
--   editor  the above, plus authoring, publishing and archiving every
--           content table, correcting and adding emergency numbers,
--           images, translations, and the report queue
--   admin   the above minus authoring: reads all profiles, changes
--           roles (never their own), writes site_settings, and holds the
--           only DELETE on the content tables
--
-- Read that middle line twice before granting anybody 'editor'. It is
-- the role that decides what this site tells a sick person to do.
-- ============================================================
