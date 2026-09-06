-- ============================================================
-- MedCare — Burmese name and description for diseases
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- WHY. `articles` has carried a Burmese half for every reader-facing
-- string since it was created — title/title_my, excerpt/excerpt_my,
-- byline/byline_my — and `diseases` never did. It got `body_my` when
-- long-form text arrived, and stopped there. So an editor could write
-- the whole of a condition's page in Burmese and still not be able to
-- write what the CARD says: the name and the one-line description a
-- reader sees on common-diseases.html stayed English-only.
--
-- On a site whose language switcher is in the masthead of every page,
-- that is a hole in the feature rather than a missing nicety. This
-- closes it.
--
-- Both columns are nullable on purpose. A translation that has not been
-- written yet is a real state, and it is not the same as an empty one:
-- the reader side falls back to the English rather than showing a blank
-- card, exactly as it already does for an article with no title_my.
-- ============================================================


-- ---------- 1. THE COLUMNS ----------

alter table public.diseases
  add column if not exists name_my text,
  add column if not exists desc_my text;

comment on column public.diseases.name_my is
  'Burmese name for the card and the page heading. Null means not translated yet; the reader side falls back to `name`.';
comment on column public.diseases.desc_my is
  'Burmese one-liner for the card. Null means not translated yet; the reader side falls back to `desc`.';


-- ---------- 2. WHAT DELIBERATELY DID NOT CHANGE ----------
--
-- No policy edits, and none are needed. The policies on this table are
-- about WHICH ROWS a reader may see:
--
--     using (status = 'published')      for anon and authenticated
--
-- and about who may write one. Neither names a column, so a new column
-- is covered by them the moment it exists. That is the general shape:
-- RLS decides which rows, GRANTs decide which columns, constraints
-- decide whether the values make sense.
--
-- No grant edits either. `authenticated` holds table-level INSERT and
-- UPDATE here, which covers columns added later; `anon` holds neither,
-- because supabase_revoke_anon_writes.sql took them away.
--
-- No NOT NULL and no backfill. Copying `name` into `name_my` would make
-- twelve rows claim a Burmese name that is really English, and the
-- fallback in script.js already renders exactly that text without
-- lying about where it came from.


-- ---------- 3. CHECKS ----------

-- Both columns, nullable text.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'diseases'
  and column_name in ('name_my', 'desc_my')
order by column_name;

-- The Burmese half of both tables, side by side. `diseases` should no
-- longer be the short one.
select 'diseases' as table, string_agg(column_name, ', ' order by column_name) as burmese_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'diseases' and column_name like '%\_my'
union all
select 'articles', string_agg(column_name, ', ' order by column_name)
from information_schema.columns
where table_schema = 'public' and table_name = 'articles' and column_name like '%\_my';

-- How much is actually translated. Expected to be 0 of 12 right away:
-- the columns exist, nobody has filled them in yet.
select count(*) filter (where name_my is not null and btrim(name_my) <> '') as named_my,
       count(*) filter (where desc_my is not null and btrim(desc_my) <> '') as described_my,
       count(*) as total
from public.diseases;
