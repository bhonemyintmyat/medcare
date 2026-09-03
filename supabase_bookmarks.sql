-- ============================================================
-- MedCare — `bookmarks` table (reader "save this")
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run.
--
-- Lets a signed-in reader save a disease or an article and find it again
-- later. That is the whole feature: no folders, no notes, no sharing. A
-- bookmark is a fact — this person saved this thing — and the table holds
-- exactly that fact and its date.
--
-- Depends on public.my_role() only indirectly: this table deliberately
-- does NOT use it, because nobody but the owner may read a bookmark. See
-- section 3.
-- ============================================================


-- ============================================================
-- WHY THIS IS NOT SHAPED LIKE `reports`
-- ============================================================
/* `reports` is the closest sibling — both are reader-generated rows that
   point at a disease or an article — so the first instinct is to copy its
   shape: a polymorphic (target_type text, target_id bigint) pair with no
   foreign key. This does the opposite, on purpose, and the reason is the
   difference between what the two tables ARE.

   A report is an audit record. It must OUTLIVE the thing it points at: if
   a wrong disease page is deleted, the report that flagged it is evidence
   and has to survive the deletion. So it cannot be a foreign key with a
   cascade, and polymorphic-with-no-FK is exactly right for it.

   A bookmark is the reverse. A bookmark to a page that no longer exists is
   not evidence, it is litter — a "saved" list full of dead links. And an
   admin CAN hard-delete a disease (the `Admins delete diseases` policy),
   so dead targets are a real possibility, not a theoretical one. A
   bookmark should vanish with its target, automatically.

   That is what a foreign key with ON DELETE CASCADE does and what a
   polymorphic column cannot. So this table uses four real, nullable
   foreign keys — disease_id, article_id, hospital_id and pharmacy_id —
   with a check that exactly one is set. Referential integrity and
   self-cleanup are worth more here than the extensibility the
   polymorphic shape buys, and adding a further kind of bookmarkable
   thing later is one migration, not a redesign — hospitals and
   pharmacies were added exactly that way.

   Same reasoning, opposite conclusion. The divergence is deliberate; a
   later reader should not "fix" it into matching reports. */


-- ---------- 1. TABLE ----------

create table if not exists public.bookmarks (
  id          bigint      generated always as identity primary key,

  -- Who saved it. Filled by the database from the session (section 2), so
  -- the browser never sends it and cannot forge it. ON DELETE CASCADE
  -- because a deleted account's private saves have no reason to linger and
  -- no one to belong to.
  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,

  -- The four possible targets. Exactly one is set; the check below
  -- enforces that. All cascade, so a hard-deleted disease, article,
  -- hospital or pharmacy takes its bookmarks with it and no dead link is
  -- ever left in a saved list.
  disease_id  bigint      references public.diseases (id)   on delete cascade,
  article_id  bigint      references public.articles (id)   on delete cascade,
  hospital_id bigint      references public.hospitals (id)  on delete cascade,
  pharmacy_id bigint      references public.pharmacies (id) on delete cascade,

  created_at  timestamptz not null default now(),

  -- Exactly one target. Not "at least one" and not "at most one" — a
  -- bookmark of nothing and a bookmark of two things are both nonsense,
  -- and the database is the only place that can refuse them for good.
  -- num_nonnulls() counts how many of the four are set.
  constraint bookmarks_one_target check (
    num_nonnulls(disease_id, article_id, hospital_id, pharmacy_id) = 1
  )
);

comment on table public.bookmarks is
  'A reader''s saved diseases, articles, hospitals and pharmacies. Private to the reader who made them — not readable by staff. One row per person per item.';
comment on column public.bookmarks.user_id is
  'The owner. Defaults to auth.uid() so the client never sends it; the RLS policies re-check it, because a default is convenience, not enforcement.';


-- ---------- 1b. UPGRADE AN EXISTING TABLE ----------
-- `create table if not exists` above builds a fresh install with all four
-- targets, but does nothing to a table that predates hospitals and
-- pharmacies. These bring such a table up to date, and are no-ops once it
-- already has the columns — so the whole file stays safe to re-run.
alter table public.bookmarks
  add column if not exists hospital_id  bigint references public.hospitals (id)  on delete cascade,
  add column if not exists pharmacy_id  bigint references public.pharmacies (id) on delete cascade;

-- Widen the one-target check from the two-column original to all four.
alter table public.bookmarks drop constraint if exists bookmarks_one_target;
alter table public.bookmarks
  add constraint bookmarks_one_target check (
    num_nonnulls(disease_id, article_id, hospital_id, pharmacy_id) = 1
  );


-- ---------- 2. SERVER-SIDE DEFAULT FOR user_id ----------
-- Same pattern as reports.reporter_id: the browser sends only the target,
-- and the database stamps the owner from the session. A plain function
-- call, not (select auth.uid()) — a DEFAULT expression may not contain a
-- subquery. The insert policy in section 3 is what actually stops one
-- account writing a bookmark owned by another.
alter table public.bookmarks alter column user_id set default auth.uid();


-- ---------- 3. LOCK IT DOWN ----------
-- The project already carries an `ensure_rls` event trigger, so RLS is
-- turned on for new tables automatically. This line is here anyway: a
-- table that protects a reading history should not depend on a trigger
-- firing to be safe, and re-enabling an already-enabled table costs
-- nothing.
alter table public.bookmarks enable row level security;

/* THE PRIVACY POINT, STATED PLAINLY.

   Which diseases a person has saved is a description of what they are
   worried about for themselves or someone close to them. It is exactly
   the "identifiable health data" the admin area was deliberately built to
   never collect — the reason there are no traffic charts and no per-page
   view counts anywhere in this project.

   So this table has NO staff policy. An editor cannot read it; an admin
   cannot read it. There is no moderation queue and no "popular saves"
   dashboard, because building one would mean an administrator could sit
   and read what any named person has been looking up. The only account
   that can see a bookmark is the account that made it. That is not a
   limitation to be relaxed later without a real decision — it is the
   feature behaving correctly. */

-- A bookmark is added or removed, never edited. Revoke UPDATE outright so
-- the intent is enforced by privilege, not merely unexpressed. DELETE
-- stays granted (Supabase grants it by default) because un-saving IS a
-- delete, and it is governed by the delete policy below.
revoke update on public.bookmarks from anon, authenticated;


-- ---------- 4. POLICIES ----------

drop policy if exists "Readers read their own bookmarks"   on public.bookmarks;
drop policy if exists "Readers add their own bookmarks"    on public.bookmarks;
drop policy if exists "Readers remove their own bookmarks" on public.bookmarks;

-- SELECT: you see your own saves and nobody else's. This is the whole of
-- who-can-read: there is intentionally no second, staff-facing SELECT
-- policy to sit beside it.
create policy "Readers read their own bookmarks"
  on public.bookmarks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- INSERT: you may save something as yourself. The check re-proves
-- ownership so the default cannot be overridden by a client that sends its
-- own user_id.
create policy "Readers add their own bookmarks"
  on public.bookmarks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- DELETE: you may remove your own saves. This is the normal "un-bookmark"
-- action — unlike reports, where delete is revoked because the row is a
-- record. Here the row is a convenience and the reader owns it outright.
create policy "Readers remove their own bookmarks"
  on public.bookmarks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- DELIBERATELY ABSENT:
--   * no `anon` policy — a bookmark that cannot follow you to another
--     device is a localStorage feature, not a database one. Logged-out
--     "save" belongs in the browser until the person signs in.
--   * no staff policy of any kind — see the privacy note in section 3.
--   * no UPDATE policy, and UPDATE is revoked — nothing about a saved item
--     changes; you save it or you don't.


-- ---------- 5. INDEXES ----------

-- Idempotent saving. Two partial unique indexes rather than one composite,
-- because a plain UNIQUE(user_id, disease_id, article_id) would treat the
-- NULL target column as distinct every time and let the same item be saved
-- again and again. Each index covers only the rows where its column is
-- set, so "this person, this disease" and "this person, this article" are
-- each unique and a repeat save is a no-op the client can ignore.
create unique index if not exists bookmarks_user_disease_uidx
  on public.bookmarks (user_id, disease_id) where disease_id is not null;

create unique index if not exists bookmarks_user_article_uidx
  on public.bookmarks (user_id, article_id) where article_id is not null;

create unique index if not exists bookmarks_user_hospital_uidx
  on public.bookmarks (user_id, hospital_id) where hospital_id is not null;

create unique index if not exists bookmarks_user_pharmacy_uidx
  on public.bookmarks (user_id, pharmacy_id) where pharmacy_id is not null;

-- The one query the reader's "Saved" page runs: my bookmarks, newest
-- first.
create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);


-- ---------- 6. CHECKS ----------

-- RLS must be on.
select relname as "table", relrowsecurity as rls_enabled
from pg_class where oid = 'public.bookmarks'::regclass;

-- Exactly three policies, all for `authenticated`, none mentioning
-- my_role(): no staff visibility.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'bookmarks'
order by cmd, policyname;

-- authenticated must NOT hold UPDATE.
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'bookmarks'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

/* The tests worth running by hand, signed in as a normal reader (not
   staff), each inside a transaction you roll back:

     -- should succeed: save a disease as yourself
     insert into public.bookmarks (disease_id) values (<a published disease id>);

     -- should be refused by bookmarks_one_target: two targets
     insert into public.bookmarks (disease_id, article_id) values (1, 1);

     -- should be refused by bookmarks_one_target: no target
     insert into public.bookmarks default values;

     -- should be refused by the unique index: same disease twice
     insert into public.bookmarks (disease_id) values (<same id as above>);

     -- should be refused by the insert policy: a bookmark owned by
     -- someone else
     insert into public.bookmarks (user_id, disease_id)
       values ('00000000-0000-0000-0000-000000000000', 1);

   and, signed in as an EDITOR or ADMIN:

     -- should return ZERO rows — staff cannot read anyone's saves
     select * from public.bookmarks;
*/
