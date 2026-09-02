-- ============================================================
-- MedCare — the contact details behind the Contact us page
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_admin_scope.sql, which creates site_settings.
-- Safe to re-run.
--
-- WHAT THIS ADDS: nothing. No table, no policy, no grant. site_settings
-- already exists, is already world-readable, and is already writable by
-- admins alone — contact.html reads it as an anonymous visitor and
-- admin/contact.html writes it as an admin, both under the rules
-- supabase_admin_scope.sql section 2 wrote down.
--
-- WHAT IT DOES: reshapes one row. 'footer.contact' was seeded there as
--
--     { "email": "", "phone": "", "address": "" }
--
-- and the page that finally reads it needs
--
--     { "email": "…@gmail.com",
--       "phones": [ { "label": "Office line",
--                     "number": "+95 …",
--                     "hint":   "Monday to Friday, 9am to 5pm" } ] }
--
-- Two changes, and the reason for each:
--
--   phone -> phones   One office number was an assumption, not a
--                     requirement. A clinic line and a mobile are two
--                     numbers, and a list costs nothing today while a
--                     second column costs a migration later.
--
--   address dropped   The page offers an email address and phone
--                     numbers, and nothing else. A postal address that
--                     no screen renders is a field somebody will one day
--                     fill in and then believe is published.
--
-- NOTHING IS THROWN AWAY. An existing phone becomes the first entry of
-- phones, and an existing address is kept under 'retired_address' rather
-- than deleted: this file cannot know whether somebody typed something
-- there that matters, and a value nobody can get back is not a value
-- this migration is entitled to remove. Delete that field by hand once
-- you have looked at it.
--
-- THE ADDRESS MUST BE A GMAIL ONE. That rule is not in the database. It
-- is enforced by admin/contact.html on the way in and by contact.js on
-- the way out, because it is a rule about which mailbox the team opens,
-- not about what the column may hold — and a check constraint here would
-- fail a save at the last possible moment with a message nobody in the
-- admin area could turn into a sentence.
-- ============================================================


-- ============================================================
-- 1. THE ROW
-- ============================================================
/* Created if this is a fresh database, so that admin/contact.html has
   something to update rather than insert. `on conflict do nothing`:
   re-running must not blank details somebody has already entered. */

insert into public.site_settings (key, value) values
  ('footer.contact', jsonb_build_object('email', '', 'phones', '[]'::jsonb))
on conflict (key) do nothing;


-- ============================================================
-- 2. THE RESHAPE
-- ============================================================
/* Idempotent by construction: it only touches a row that still has no
   'phones' key. A second run finds one and changes nothing, so this file
   can sit in the repository next to the others and be re-run with them.

   Written as one update rather than a function because it runs once per
   database and reads better as the value it produces. */

update public.site_settings
set value =
      jsonb_build_object(
        'email', coalesce(value->>'email', ''),
        'phones',
          case
            when coalesce(trim(value->>'phone'), '') = '' then '[]'::jsonb
            else jsonb_build_array(
                   jsonb_build_object(
                     'label',  'Office line',
                     'number', trim(value->>'phone'),
                     'hint',   ''
                   )
                 )
          end
      )
      -- Kept, not dropped. See the header: this migration is not
      -- entitled to destroy something a person typed.
      || case
           when coalesce(trim(value->>'address'), '') = '' then '{}'::jsonb
           else jsonb_build_object('retired_address', trim(value->>'address'))
         end
where key = 'footer.contact'
  and not (value ? 'phones');

/* The stamp trigger sets updated_by from auth.uid(), which is null when
   this runs in the SQL editor. That is correct and it is what the admin
   screen reports: "Never changed from this screen" is true of a row that
   a migration shaped and no person has touched. */


-- ============================================================
-- 3. CHECKS
-- ============================================================

-- The row, in its new shape. Expect one line, with a 'phones' array —
-- empty on a fresh database, one entry where a phone had been typed.
select key, value, updated_at
from public.site_settings
where key = 'footer.contact';

-- Anything left behind by the reshape, to be looked at and removed by
-- hand. Expect no rows on a database where nobody had filled in an
-- address.
select key, value->>'retired_address' as retired_address
from public.site_settings
where key = 'footer.contact' and value ? 'retired_address';

-- Who may read and write it. Expect: select for anon and authenticated,
-- insert and update for authenticated (admins, by the policy's rule),
-- and no delete row at all.
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;
