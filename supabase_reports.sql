-- ============================================================
-- MedCare — `reports` table
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
--
-- Stores "this information is inaccurate" reports from readers.
--
-- RLS is enabled immediately after the table is created, BEFORE any
-- policy exists. With RLS on and no policies, the table is closed to
-- everyone holding the anon key: reads come back empty and writes are
-- refused. That is deliberate — the table is locked by default and
-- opens only as far as the policies in the next step allow.
-- ============================================================


-- ---------- 1. TABLE ----------

create table if not exists public.reports (
  id         bigint      generated always as identity primary key,

  -- Who reported it. NULL is allowed on purpose: see `on delete set null`
  -- below, and it also leaves room for logged-out reports later.
  user_id    uuid        references auth.users (id) on delete set null,

  -- What kind of thing is being reported. Free text for now ('disease'),
  -- so adding 'hospital' or 'article' later needs no migration.
  item_type  text        not null
                         check (char_length(trim(item_type)) > 0),

  -- Which row. Deliberately NOT a foreign key — see the note below.
  item_id    bigint      not null,

  -- What the reader says is wrong. Bounded so an empty or a pasted-novel
  -- submission cannot reach the moderation queue.
  reason     text        not null
                         check (char_length(trim(reason)) between 10 and 2000),

  -- Workflow state. Defaults to 'new' so every report starts unreviewed.
  status     text        not null default 'new'
                         check (status in ('new', 'reviewed')),

  created_at timestamptz not null default now()
);

comment on table  public.reports is 'Reader-submitted accuracy reports awaiting editorial review.';
comment on column public.reports.item_id is
  'Id of the reported row in the table named by item_type. Not a foreign key: the target table varies, so the database cannot enforce it.';
comment on column public.reports.status is
  'new = awaiting review, reviewed = an editor has dealt with it. The default only fills the column when omitted; policies must enforce that submitters cannot set it.';


-- ---------- 2. LOCK IT DOWN, IMMEDIATELY ----------
-- Enabled here, in the same script, so there is never a window in which
-- the table exists and is readable by anyone with the anon key.

alter table public.reports enable row level security;

-- No policies yet, on purpose. Right now:
--   * anon and authenticated  -> select returns [], insert/update/delete refused
--   * service_role and the SQL editor -> unaffected, they bypass RLS
-- Policies come in the next step.


-- ---------- 3. INDEXES ----------
-- Small tables do not need these, but a moderation queue grows quickly
-- and all three of these queries are ones you will actually run.

-- "show me everything still to review"
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

-- "has this disease been reported?"
create index if not exists reports_item_idx
  on public.reports (item_type, item_id);

-- "what has this person reported?"
create index if not exists reports_user_idx
  on public.reports (user_id);


-- ---------- 4. CHECKS ----------

-- RLS must be on.
select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.reports'::regclass;

-- Should return no rows: the table is locked and has no policies yet.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'reports';

-- Columns, types, defaults.
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reports'
order by ordinal_position;
