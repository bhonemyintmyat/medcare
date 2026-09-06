-- ============================================================
-- MedCare — remove duplicated hospitals, fill the blank phone column
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_seed_hospitals.sql. Safe to re-run.
--
-- WHY THIS EXISTS
--
-- hospitals.html does not read the array in script.js once the table has
-- rows — the array is only the offline fallback. So editing script.js
-- changes nothing a visitor sees, and this file is the half that does.
-- It makes the table say what the array now says: 58 hospitals, no
-- duplicates, and no blank phone column.
--
-- READ THIS BEFORE ANYONE DIALS ANYTHING.
--
-- Section 2 does NOT add real phone numbers. It writes one placeholder,
-- 01-000000, into every row that has none — the same value in all 47, so
-- that it reads as a stand-in and not as that hospital's line. The 11
-- rows that already carry a number are not touched. Replace the
-- placeholders per row as real numbers are confirmed.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The seven rows that are one hospital entered twice.
--
--    Each pair was the same place: once with a phone number and once
--    without, or once per township for a building on a border — Pinlon
--    Hospital is filed under both North Dagon and Thingangyun with the
--    same street corner and the same ward in both addresses.
--
--    The copy that survives is the one carrying a real phone number,
--    or the first one entered where neither had one.
--
--    Deleting a hospital cascades to bookmarks.hospital_id, so this
--    would take a reader's saved card with it. At the time of writing
--    no bookmark pointed at any of these seven; the guard below is what
--    keeps that true rather than assumed — if one has been saved since,
--    the delete skips that row and leaves it for a person to decide.
-- ------------------------------------------------------------

delete from public.hospitals h
where (h.name, h.township) in (
    ('Yangon General Hospital - YGH',                'Lanmadaw'),
    ('Yangon General Hospital - YGH',                'Latha'),
    ('Victoria Hospital',                            'Mayangone'),
    ('North Okkalapa General and Teaching Hospital', 'North Okkalapa'),
    ('Yangon Children''s Hospital',                  'Sanchaung'),
    ('Pinlon Hospital',                              'Thingangyun'),
    ('Yankin Children''s Hospital',                  'Yankin')
  )
  and h.phone is null
  and not exists (select 1 from public.bookmarks b where b.hospital_id = h.id);


-- ------------------------------------------------------------
-- 2. A placeholder where there is no number.
--
--    Only rows that are still null are touched, so re-running this
--    after somebody has typed a real number does not overwrite it.
--
--    WHY THE TRIGGER COMES OFF FOR THREE LINES
--
--    hospitals_guard_publish refuses any UPDATE to a row that is
--    already published unless my_role() says the caller is an admin:
--
--      live_edit_requires_admin
--      Take it off the site first, then edit it. An admin puts it back.
--
--    That rule is aimed at an editor quietly rewriting a live page, and
--    it is worth keeping. But my_role() reads the profile belonging to
--    auth.uid(), and a SQL editor session has no auth.uid() at all — so
--    it is not an admin either, and every one of these 47 rows is
--    published. Run the UPDATE on its own and it fails.
--
--    Taking every row off the site, editing it and putting it back is
--    the other way through, but "put it back" is the publish step, which
--    needs an admin as well. So there is no route that leaves the
--    trigger on. It comes off for the length of one transaction and
--    goes straight back.
--
--    DISABLE TRIGGER is transactional in Postgres, so if anything in
--    here fails the whole thing rolls back and the trigger is still
--    armed. Only the guard is suspended: hospitals_stamp still fires,
--    so updated_at and updated_by are recorded the normal way.
--
--    If you would rather not do this, the alternative is to leave the
--    47 rows null — hospitals.html already handles that, and shows
--    "No phone number listed" instead of a Call button.
-- ------------------------------------------------------------

begin;

alter table public.hospitals disable trigger hospitals_guard_publish;

update public.hospitals
set phone = '01-000000'
where phone is null;

alter table public.hospitals enable trigger hospitals_guard_publish;

commit;


-- ------------------------------------------------------------
-- 3. What the table should look like afterwards.
--    Expect: 58 rows, 0 null phones, 47 placeholders, 11 real, and
--    no name+township pair appearing more than once.
-- ------------------------------------------------------------

select count(*)                                          as total,
       count(*) filter (where phone is null)             as still_null,
       count(*) filter (where phone = '01-000000')       as placeholder,
       count(*) filter (where phone <> '01-000000')      as real_number,
       (select count(*) from (
          select name, township from public.hospitals
          group by name, township having count(*) > 1
        ) d)                                             as duplicate_pairs
from public.hospitals;
