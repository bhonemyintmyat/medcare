select count(*)                                             as total,
       count(*) filter (where coalesce(btrim(body),'') <> '') as with_body,
       count(*) filter (where body like '%Learn more%')       as with_chrome,
       count(*) filter (where coalesce(btrim(body_my),'') <> '') as with_burmese
from public.diseases;

select id, name,
       length(body)                                        as body_len,
       (length(body) - length(replace(body, '<h2>', ''))) / 4 as h2_count,
       (length(body) - length(replace(body, '<h3>', ''))) / 4 as h3_count
from public.diseases
order by id;

select status, count(*) from public.diseases group by status;

