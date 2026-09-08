create table if not exists public.bookmarks (
  id          bigint      generated always as identity primary key,

  user_id     uuid        not null default auth.uid()
                          references auth.users (id) on delete cascade,

  disease_id  bigint      references public.diseases (id)   on delete cascade,
  article_id  bigint      references public.articles (id)   on delete cascade,
  hospital_id bigint      references public.hospitals (id)  on delete cascade,
  pharmacy_id bigint      references public.pharmacies (id) on delete cascade,

  created_at  timestamptz not null default now(),

  constraint bookmarks_one_target check (
    num_nonnulls(disease_id, article_id, hospital_id, pharmacy_id) = 1
  )
);

comment on table public.bookmarks is
  'A reader''s saved diseases, articles, hospitals and pharmacies. Private to the reader who made them — not readable by staff. One row per person per item.';
comment on column public.bookmarks.user_id is
  'The owner. Defaults to auth.uid() so the client never sends it; the RLS policies re-check it, because a default is convenience, not enforcement.';

alter table public.bookmarks
  add column if not exists hospital_id  bigint references public.hospitals (id)  on delete cascade,
  add column if not exists pharmacy_id  bigint references public.pharmacies (id) on delete cascade;

alter table public.bookmarks drop constraint if exists bookmarks_one_target;
alter table public.bookmarks
  add constraint bookmarks_one_target check (
    num_nonnulls(disease_id, article_id, hospital_id, pharmacy_id) = 1
  );

alter table public.bookmarks alter column user_id set default auth.uid();

alter table public.bookmarks enable row level security;

revoke update on public.bookmarks from anon, authenticated;

drop policy if exists "Readers read their own bookmarks"   on public.bookmarks;
drop policy if exists "Readers add their own bookmarks"    on public.bookmarks;
drop policy if exists "Readers remove their own bookmarks" on public.bookmarks;

create policy "Readers read their own bookmarks"
  on public.bookmarks
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Readers add their own bookmarks"
  on public.bookmarks
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Readers remove their own bookmarks"
  on public.bookmarks
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create unique index if not exists bookmarks_user_disease_uidx
  on public.bookmarks (user_id, disease_id) where disease_id is not null;

create unique index if not exists bookmarks_user_article_uidx
  on public.bookmarks (user_id, article_id) where article_id is not null;

create unique index if not exists bookmarks_user_hospital_uidx
  on public.bookmarks (user_id, hospital_id) where hospital_id is not null;

create unique index if not exists bookmarks_user_pharmacy_uidx
  on public.bookmarks (user_id, pharmacy_id) where pharmacy_id is not null;

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

select relname as "table", relrowsecurity as rls_enabled
from pg_class where oid = 'public.bookmarks'::regclass;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'bookmarks'
order by cmd, policyname;

select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and table_name = 'bookmarks'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

