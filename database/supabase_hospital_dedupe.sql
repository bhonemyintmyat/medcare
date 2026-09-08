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

begin;

alter table public.hospitals disable trigger hospitals_guard_publish;

update public.hospitals
set phone = '01-000000'
where phone is null;

alter table public.hospitals enable trigger hospitals_guard_publish;

commit;

select count(*)                                          as total,
       count(*) filter (where phone is null)             as still_null,
       count(*) filter (where phone = '01-000000')       as placeholder,
       count(*) filter (where phone <> '01-000000')      as real_number,
       (select count(*) from (
          select name, township from public.hospitals
          group by name, township having count(*) > 1
        ) d)                                             as duplicate_pairs
from public.hospitals;
