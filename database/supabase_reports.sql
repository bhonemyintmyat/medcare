create table if not exists public.reports (
  id         bigint      generated always as identity primary key,

  user_id    uuid        references auth.users (id) on delete set null,

  item_type  text        not null
                         check (char_length(trim(item_type)) > 0),

  item_id    bigint      not null,

  reason     text        not null
                         check (char_length(trim(reason)) between 10 and 2000),

  status     text        not null default 'new'
                         check (status in ('new', 'reviewed')),

  created_at timestamptz not null default now()
);

comment on table  public.reports is 'Reader-submitted accuracy reports awaiting editorial review.';
comment on column public.reports.item_id is
  'Id of the reported row in the table named by item_type. Not a foreign key: the target table varies, so the database cannot enforce it.';
comment on column public.reports.status is
  'new = awaiting review, reviewed = an editor has dealt with it. The default only fills the column when omitted; policies must enforce that submitters cannot set it.';

alter table public.reports enable row level security;

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

create index if not exists reports_item_idx
  on public.reports (item_type, item_id);

create index if not exists reports_user_idx
  on public.reports (user_id);

select relname as table, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.reports'::regclass;

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'reports';

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reports'
order by ordinal_position;
