create table if not exists public.pages (

  slug       text        primary key
                         constraint pages_slug_not_blank
                         check (char_length(trim(slug)) > 0),

  title      text        not null default '',

  body       text        not null default '',
  body_my    text        not null default '',

  href       text        not null,

  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users (id) on delete set null
);

comment on table public.pages is
  'Prose for the footer pages that carry no medical advice. Rendered as sanitised HTML by page-body.js; an empty body means the page shows the copy in its own HTML file.';

comment on column public.pages.href is
  'The deployed file this row backs. Used by the admin screen to read today''s prose back out of it. Not writable from the client.';

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

revoke execute on function public.stamp_page() from public, anon, authenticated;

alter table public.pages enable row level security;

drop policy if exists "Anyone reads pages"   on public.pages;
drop policy if exists "Admins write pages"   on public.pages;
drop policy if exists "Admins change pages"  on public.pages;

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

revoke insert, update, delete on public.pages from anon;

revoke update on public.pages from authenticated;
grant  update (title, body, body_my) on public.pages to authenticated;

insert into public.pages (slug, title, href) values
  ('about',   'About MedCare',   'about.html'),
  ('terms',   'Terms of use',    'terms.html'),
  ('privacy', 'Privacy policy',  'privacy.html'),
  ('cookies', 'Cookie Settings', 'cookies.html')
on conflict (slug) do nothing;

select slug,
       title,
       href,
       case when char_length(trim(body))    > 0 then 'database' else 'file' end as english,
       case when char_length(trim(body_my)) > 0 then 'database' else 'file' end as burmese,
       updated_at
from public.pages
order by slug;

select policyname, cmd, roles::text, coalesce(qual, with_check) as rule
from pg_policies
where schemaname = 'public' and tablename = 'pages'
order by cmd, policyname;

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'pages'
  and grantee in ('authenticated', 'anon')
order by grantee, column_name;
