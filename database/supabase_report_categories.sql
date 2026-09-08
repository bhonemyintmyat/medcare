alter table public.reports
  add column if not exists category text not null default 'other';

alter table public.reports drop constraint if exists reports_category_check;

alter table public.reports
  add constraint reports_category_check
  check (category in ('inaccuracy', 'typo', 'broken_link', 'other'));

comment on column public.reports.category is
  'What kind of problem the reader is reporting. Routes the report to the right person; `reason` is still what they act on. Defaults to ''other'' so pre-existing rows and older clients remain valid.';

create index if not exists reports_category_status_idx
  on public.reports (category, status, created_at desc);

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'reports' and column_name = 'category';

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.reports'::regclass and conname = 'reports_category_check';

select category, count(*) from public.reports group by category order by category;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'reports'
  and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
order by grantee, column_name;
