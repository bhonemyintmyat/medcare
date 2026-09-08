insert into public.site_settings (key, value) values
  ('footer.contact', jsonb_build_object('email', '', 'phones', '[]'::jsonb))
on conflict (key) do nothing;

update public.site_settings
set value =
      jsonb_build_object(
        'email', coalesce(value->>'email', ''),
        'phones',
          case
            when coalesce(trim(value->>'phone'), '') = '' then '[]'::jsonb
            else jsonb_build_array(
                   jsonb_build_object(
                     'label',  'Office line',
                     'number', trim(value->>'phone'),
                     'hint',   ''
                   )
                 )
          end
      )

      || case
           when coalesce(trim(value->>'address'), '') = '' then '{}'::jsonb
           else jsonb_build_object('retired_address', trim(value->>'address'))
         end
where key = 'footer.contact'
  and not (value ? 'phones');

select key, value, updated_at
from public.site_settings
where key = 'footer.contact';

select key, value->>'retired_address' as retired_address
from public.site_settings
where key = 'footer.contact' and value ? 'retired_address';

select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'site_settings'
order by cmd, policyname;
