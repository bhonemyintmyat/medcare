-- ============================================================
-- MedCare — publishing requires an admin
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_editor.sql and supabase_admin_scope.sql.
-- Safe to re-run.
--
-- Until now an editor could carry a page the whole way: write it, and
-- publish it. `pending` existed but nothing made anybody stop there.
-- This file makes the last step somebody else's.
--
--   draft  -> pending          editor
--   pending -> published       ADMIN ONLY
--   published -> published     ADMIN ONLY   (editing a page in place)
--   published -> archived      editor       (taking a page DOWN is safe)
--   published -> draft         editor       (same, with the text kept)
--   archived -> draft          editor
--
-- The asymmetry is the point. Putting something in front of readers, or
-- changing what is already in front of them, is the direction that needs
-- a second person; taking something off the site is what you want any
-- editor to be able to do the moment they think a page is wrong, without
-- hunting for an admin.
--
-- A live row is not an editor's to rewrite. To fix a published page they
-- take it down first — one click, no approval — and it goes back up when
-- an admin publishes it. Section 4 is about what that costs.
-- ============================================================


-- ============================================================
-- 1. WHY A TRIGGER AND NOT A POLICY
-- ============================================================
/* The natural first attempt is a WITH CHECK on the UPDATE policy:

     with check (my_role() = 'admin' or status <> 'published')

   It is wrong, and wrong in a way that passes a quick test. WITH CHECK
   sees only the row as it WILL be. So it fires on every update to an
   already-published row — an editor fixing a typo on a live page is
   refused, because the row they are writing has status 'published',
   even though they never touched the status column.

   Deciding "did this update PUBLISH something" needs both the old row
   and the new one, and in Postgres that means a trigger. */


-- ============================================================
-- 2. THE GUARD
-- ============================================================

create or replace function public.guard_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text := (select public.my_role());
begin
  /* Admins are unrestricted. my_role() is SECURITY DEFINER and reads the
     caller's stored profile row, so this is what the database believes
     about them, not what the request claimed. */
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

  /* Editing a row that is already live. Refused: this is the same act as
     publishing — it changes what a reader sees — and the whole point of
     approval is lost if it can be reached by rewriting an existing page
     instead of publishing a new one.

     Checked BEFORE the transition rule below, because it is the case
     people actually hit, and its hint is the one that tells them what to
     do about it. */
  if old.status = 'published' and new.status = 'published' then
    raise exception 'live_edit_requires_admin'
      using errcode = '42501',
            hint = 'Take it off the site first, then edit it. An admin puts it back.';
  end if;

  /* Any other move INTO published: draft, pending or archived going
     live. That is the approval step itself. */
  if new.status = 'published' and old.status is distinct from 'published' then
    raise exception 'publish_requires_admin'
      using errcode = '42501',
            hint = 'Submit it for review instead. An admin publishes it.';
  end if;

  /* Everything left is an editor working on something readers cannot
     see, or taking something down. Both are theirs. */
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

/* emergency_contacts is in that list on purpose. supabase_admin_scope.sql
   moved INSERT there to editors so the table was not unreachable, and
   noted plainly that it left one pair of hands rather than two. This is
   the second pair: an editor may now type an ambulance number and correct
   one, and an admin is what puts it in front of readers. */


-- ============================================================
-- 3. THE ADMIN HAS TO BE ABLE TO SEE WHAT IS WAITING
-- ============================================================
-- A permission with no way to exercise it is the trap this project has
-- already walked into once, with emergency_contacts INSERT. Admins
-- already reach every editor screen — editor-guard.js admits
-- ('editor', 'admin') and every content policy reads the same — so the
-- review queue is editor/content.html filtered to pending, and the
-- Publish button appears there for admins and for nobody else.
--
-- The view is not what the editor desk reads — that screen already has
-- every row in memory for its other counts, and going to the database
-- again for a number it can add up locally would be a round trip to
-- save an addition. It is here for the things that have no page: a psql
-- session, a scheduled "what is waiting" mail, an overview screen if one
-- is ever built. If nothing grows to need it, it costs a view.

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

/* security_invoker: the view runs as whoever selects from it, so the
   base tables' policies still apply and this cannot become a way to read
   rows a role could not read directly. Without it a view is owned by the
   definer and would hand every caller the owner's reach. */
alter view public.pending_review set (security_invoker = on);

grant select on public.pending_review to authenticated;


-- ============================================================
-- 4. WHAT THIS COSTS, AND WHAT IS STILL MISSING
-- ============================================================
/* The rule above is the strict one. An editor cannot put anything in
   front of a reader, by any route: not by publishing a draft, and not by
   rewriting a page that is already published. There is no way to reach
   the public site from the editor role without an admin acting.

   THE PRICE, STATED PLAINLY

   Fixing a typo on a live page now takes that page off the site until an
   admin is available. The editor takes it down, corrects it, submits it;
   a reader arriving in between finds nothing where the dengue page was.
   On a health information site that is a real harm, not a theoretical
   one, and it is the direct cost of the guarantee.

   Two things soften it, and they are why this is workable:

     - Taking a page down is one click and needs nobody. The dangerous
       state (wrong information, live) ends immediately. Only the repair
       waits.
     - published -> draft keeps the text. The editor is not retyping the
       page, they are moving it out of public view to work on it.

   WHERE THIS BITES HARDEST: emergency_contacts

   Worth being explicit, because it is the one place the trade-off may
   come out the other way. A wrong ambulance number cannot be corrected
   in place by an editor. They must take it off the page — leaving
   readers with no number for that service — and wait for an admin to
   republish the corrected one.

   Whether that is right depends on which you think is worse: a wrong
   emergency number visible, or no emergency number visible. Removing a
   wrong number fast is clearly correct; blocking the correction behind
   an admin is the part that may not be. To exempt that one table and let
   editors correct live numbers in place, add this as the first statement
   in the UPDATE branch of guard_publish() above and re-run:

     if tg_table_name = 'emergency_contacts'
        and old.status = 'published' and new.status = 'published' then
       return new;
     end if;

   That is a deliberate hole with a clear rationale, not an oversight.
   Left out by default because it was not what was asked for.

   WHAT WOULD REMOVE THE PRICE ENTIRELY

   Draft revisions of published rows: a revisions table, an editing
   surface that writes to it, a diff for the admin, and a publish step
   that promotes a revision onto the live row. The page never leaves the
   site, and approval still gates every word readers see. It is a
   feature, not a migration — the natural next step, when there is time
   for it, and the thing that makes this section obsolete.

   THE UI HAS TO AGREE WITH THIS FILE

   The trigger refuses; it does not explain. editor-api.js has
   canEditNow() and lockedNote(), and every screen asks them before
   drawing a Save button. If you relax the rule here — the
   emergency_contacts carve-out above, say — relax it there too, or
   editors keep meeting a button that returns 42501.


-- ============================================================
-- 5. CHECKS
-- ============================================================

-- The guard is attached to all four content tables. Expect four rows.
select tgrelid::regclass as on_table, tgname
from pg_trigger
where not tgisinternal and tgname like '%_guard_publish'
order by on_table;

-- The review queue reads, and runs as the caller.
select c.relname, c.reloptions
from pg_class c
where c.relname = 'pending_review';

select kind, count(*) from public.pending_review group by kind order by kind;

/* The test worth running by hand, signed in as an EDITOR:

     -- should be refused with publish_requires_admin
     update public.diseases set status = 'published' where id = <a pending id>;

     -- should succeed: taking something down needs no approval
     update public.diseases set status = 'archived' where id = <a published id>;

     -- should be refused with live_edit_requires_admin
     update public.diseases set "desc" = 'edited' where id = <a published id>;

     -- should succeed: taking it down and editing in one move is how an
     -- editor is meant to fix a live page
     update public.diseases set "desc" = 'edited', status = 'draft'
       where id = <a published id>;

   and the same four as an ADMIN, where the first and third should now
   succeed. If the third is refused for an admin, my_role() is not
   returning 'admin' for them and the problem is in supabase_editor.sql,
   not here. */
