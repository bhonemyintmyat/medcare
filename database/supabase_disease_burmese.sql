alter table public.diseases
  add column if not exists name_my text,
  add column if not exists desc_my text;

comment on column public.diseases.name_my is
  'Burmese name for the card and the page heading. Null means not translated yet; the reader side falls back to `name`.';
comment on column public.diseases.desc_my is
  'Burmese one-liner for the card. Null means not translated yet; the reader side falls back to `desc`.';

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'diseases'
  and column_name in ('name_my', 'desc_my')
order by column_name;

select 'diseases' as table, string_agg(column_name, ', ' order by column_name) as burmese_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'diseases' and column_name like '%\_my'
union all
select 'articles', string_agg(column_name, ', ' order by column_name)
from information_schema.columns
where table_schema = 'public' and table_name = 'articles' and column_name like '%\_my';

select count(*) filter (where name_my is not null and btrim(name_my) <> '') as named_my,
       count(*) filter (where desc_my is not null and btrim(desc_my) <> '') as described_my,
       count(*) as total
from public.diseases;
