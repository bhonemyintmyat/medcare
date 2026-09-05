-- ============================================================
-- MedCare — the footer pages, kept in the database
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_scope.sql, which creates my_role().
-- Safe to re-run.
--
-- WHAT THIS IS FOR. Four pages hang off the footer and carry no medical
-- advice: About MedCare, Terms of use, Privacy policy, and Cookie
-- settings. All four are hand-written HTML files today, which means
-- correcting a sentence in the privacy policy is a code change. This
-- table lets an admin edit their prose from the admin area instead.
--
-- WHY NOT site_settings. That table already holds 'legal.terms',
-- 'legal.privacy' and 'legal.cookies' — seeded empty by
-- supabase_admin_scope.sql section 2a, never read, never written. They
-- are a stub from before these pages existed, and this file does not
-- use them, because the table says of itself:
--
--     'Plain text and booleans only. Anything rendered from here goes
--      through textContent, never innerHTML.'
--
-- That invariant is worth keeping. site_settings also carries
-- maintenance mode and the site-wide notice, and a table whose contents
-- are never trusted to innerHTML is a table one class of bug cannot
-- reach. A page body IS rendered as HTML, so it belongs somewhere else —
-- next to `diseases.body` and `articles.body`, which are already
-- sanitised HTML and already rendered that way by read.js.
--
-- The three legal.* rows are left in place rather than deleted. They are
-- empty, nothing reads them, and there is no DELETE policy on that table
-- for anybody; removing them is a tidy-up for a day when somebody has
-- checked no other branch expects them.
--
-- WHO MAY WRITE. Admins alone, which is the rule
-- supabase_contact_editors.sql already set down for legal text:
--
--   maintenance     admin only
--   notice          admin only
--   legal text      admin only        <- these pages
--   footer.contact  editor and admin
--
-- Editors get a read-only screen at editor/pages.html so they can see
-- what the site says and raise a correction; the Save button is an
-- admin's. Nothing here grants an editor a write, and RLS refuses one
-- whatever a screen chooses to draw.
--
-- NOTHING BLANKS. Every row is seeded EMPTY on purpose. Each of the four
-- pages ships its full prose in the HTML file, and page-body.js renders
-- the row only when the row has something in it. So on the day this file
-- runs, every page still shows exactly what it showed the day before —
-- the same rule contact.html already follows for 'footer.contact'.
--
-- Filling a row is done from the screen, not from here: admin/pages.html
-- reads today's prose back out of the deployed page (editor-import.js,
-- the same module the entry form uses for the twenty hand-written
-- articles), shows it, and saves nothing until an admin presses Save.
-- That keeps this migration free of a thousand lines of quoted prose
-- that would go stale the first time somebody edited an HTML file.
-- ============================================================


-- ============================================================
-- 1. THE TABLE
-- ============================================================

create table if not exists public.pages (
  -- The page, named the way the screens and the public pages both spell
  -- it. Short and stable: it is written into the HTML files as
  -- data-page-slug, so renaming one means editing a file.
  slug       text        primary key
                         constraint pages_slug_not_blank
                         check (char_length(trim(slug)) > 0),

  -- Shown in the admin list and nowhere else yet. The public pages carry
  -- their own <h1>, because a page whose heading arrives over the network
  -- has nothing to show while it is arriving.
  title      text        not null default '',

  -- The prose, as sanitised HTML. English and Burmese are stored apart
  -- for the same reason diseases and articles store them apart: the
  -- allowlist strips the classes that would otherwise tell them apart.
  body       text        not null default '',
  body_my    text        not null default '',

  -- Which file this row backs. Read by the admin screen to import
  -- today's prose, and NOT in the column grant below — an editable href
  -- would be a way to make the screen fetch some other page.
  href       text        not null,

  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users (id) on delete set null
);

comment on table public.pages is
  'Prose for the footer pages that carry no medical advice. Rendered as sanitised HTML by page-body.js; an empty body means the page shows the copy in its own HTML file.';

comment on column public.pages.href is
  'The deployed file this row backs. Used by the admin screen to read today''s prose back out of it. Not writable from the client.';


-- ============================================================
-- 2. THE STAMP
-- ============================================================
/* Same shape as stamp_site_setting(): the key cannot be changed by an
   update, and who-and-when is recorded by the database rather than sent
   by the browser. `href` is pinned here as well as withheld from the
   grant, so neither a missing grant nor a future one can move it. */

create or replace function public.stamp_page()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.slug       := coalesce(old.slug, new.slug);
  new.href       := coalesce(old.href, new.href);
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pages_stamp on public.pages;
create trigger pages_stamp
  before insert or update on public.pages
  for each row execute function public.stamp_page();

/* Postgres grants EXECUTE on a new function to public by default, and
   that is enough for PostgREST to publish it at /rest/v1/rpc/stamp_page.
   Calling a trigger function outside a trigger only ever raises, so this
   is noise rather than a hole — but a trigger function has no caller
   except its trigger, and saying so beats relying on the error.

   The trigger is unaffected: it runs as the table owner, not as the role
   that issued the write.

   The older stamp functions (stamp_content, stamp_site_setting,
   stamp_translation) still carry the default grant. Tightening those is
   a change to three other tables' triggers and is not this file's to
   make. */
revoke execute on function public.stamp_page() from public, anon, authenticated;


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================

alter table public.pages enable row level security;

drop policy if exists "Anyone reads pages"   on public.pages;
drop policy if exists "Admins write pages"   on public.pages;
drop policy if exists "Admins change pages"  on public.pages;

/* World-readable, anon included: these are public pages, and the
   visitor reading the privacy policy is usually not signed in. */
create policy "Anyone reads pages"
  on public.pages for select to anon, authenticated
  using (true);

create policy "Admins write pages"
  on public.pages for insert to authenticated
  with check ((select public.my_role()) = 'admin');

create policy "Admins change pages"
  on public.pages for update to authenticated
  using      ((select public.my_role()) = 'admin')
  with check ((select public.my_role()) = 'admin');

/* No DELETE policy for anybody, and for the same reason site_settings
   has none: a page is emptied, not removed. An empty row already means
   "show the file's own copy", so deleting one gains nothing and loses
   the record of who emptied it. */

-- Refuse an anonymous write at the privilege check, before RLS is asked.
revoke insert, update, delete on public.pages from anon;

-- And narrow what an authenticated write can even name. slug, href,
-- updated_at and updated_by are the database's to set, not the form's.
revoke update on public.pages from authenticated;
grant  update (title, body, body_my) on public.pages to authenticated;


-- ============================================================
-- 4. THE FOUR ROWS
-- ============================================================
/* Seeded empty. See the header: an empty body means each page keeps
   showing the prose in its own file, so running this changes nothing a
   reader can see. `on conflict do nothing` so a re-run cannot wipe text
   an admin has since written. */

insert into public.pages (slug, title, href) values
  ('about',   'About MedCare',   'about.html'),
  ('terms',   'Terms of use',    'terms.html'),
  ('privacy', 'Privacy policy',  'privacy.html'),
  ('cookies', 'Cookie Settings', 'cookies.html')
on conflict (slug) do nothing;


-- ============================================================
-- 5. CHECKS
-- ============================================================

-- The four rows, and whether anybody has written prose into one yet.
-- Expect four rows and 'file' in every row on the day this file runs.
select slug,
       title,
       href,
       case when char_length(trim(body))    > 0 then 'database' else 'file' end as english,
       case when char_length(trim(body_my)) > 0 then 'database' else 'file' end as burmese,
       updated_at
from public.pages
order by slug;

-- Every policy on the table. Expect SELECT for anon+authenticated, and
-- INSERT and UPDATE naming 'admin'. There must be no DELETE row.
select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'pages'
order by cmd, policyname;

-- What a signed-in browser may write. Expect exactly title, body and
-- body_my to `authenticated`, and nothing at all to `anon`.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'pages'
  and grantee in ('authenticated', 'anon')
order by grantee, column_name;
