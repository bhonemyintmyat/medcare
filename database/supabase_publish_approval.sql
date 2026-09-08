







create or replace function public.guard_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := (select public.my_role());
begin
  if actor_role = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'published' then
      raise exception 'publish_requires_admin'
        using errcode = '42501',
              hint = 'New entries start as a draft. An admin publishes them.';
    end if;
    return new;
  end if;

  if old.status = 'published' and new.status = 'published' then
    raise exception 'live_edit_requires_admin'
      using errcode = '42501',
            hint = 'Take it off the site first, then edit it. An admin puts it back.';
  end if;

  if new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'publish_requires_admin'
      using errcode = '42501',
            hint = 'Submit it for review instead. An admin publishes it.';
  end if;

  return new;
end;
$$;

comment on function public.guard_publish() is
  'Refuses any transition into status = published, and any edit to an already-published row, unless the caller is an admin. Editors may still unpublish and archive.';

do $$
declare
  t text;
begin
  foreach t in array array['diseases', 'articles', 'hospitals', 'emergency_contacts']
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_publish', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.guard_publish()',
      t || '_guard_publish', t
    );
  end loop;
end
$$;






create or replace view public.pending_review as
  select 'disease'::text as kind, id, name  as title, updated_at, updated_by from public.diseases           where status = 'pending'
  union all
  select 'article'::text,          id, title,          updated_at, updated_by from public.articles          where status = 'pending'
  union all
  select 'hospital'::text,         id, name,           updated_at, updated_by from public.hospitals         where status = 'pending'
  union all
  select 'emergency'::text,        id, name,           updated_at, updated_by from public.emergency_contacts where status = 'pending';

comment on view public.pending_review is
  'Everything sitting at status = pending, for the review queue. Reads through the callers own RLS on each underlying table.';


alter view public.pending_review set (security_invoker = on);

grant select on public.pending_review to authenticated;



