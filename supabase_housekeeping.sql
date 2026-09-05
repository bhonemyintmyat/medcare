-- ============================================================
-- MedCare — the one housekeeping check the browser cannot make
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER supabase_auth.sql and supabase_admin_scope.sql.
-- Safe to re-run.
--
-- WHAT admin/housekeeping.html LOOKS FOR, AND WHERE FROM
--
--   content with no owner      public.diseases / articles / hospitals /
--                              emergency_contacts, read directly
--   dead links                 every href fetched from the browser
--   unapproved source URLs     source_url, read directly
--   accounts with no profile   HERE
--
-- The first three are rows an admin can already select, so the screen
-- reads them itself and this file has nothing to add. The fourth cannot
-- be done that way: the missing thing is a row in public.profiles, and
-- the evidence that it should exist is a row in auth.users — which no
-- browser may read, whatever its role, and rightly so.
--
-- WHY THERE WOULD EVER BE ONE. handle_new_user() in supabase_auth.sql
-- creates a profile the moment an account is created, and it is a
-- trigger inside the database rather than a call from the tab, so a
-- closed tab cannot skip it. An orphan therefore means something
-- unusual: an account made before that trigger existed and missed by the
-- backfill, an account created directly in the dashboard while the
-- trigger was disabled, or a profile deleted by hand.
--
-- That is exactly the sort of thing a housekeeping screen exists to
-- notice: rare, invisible from every normal screen, and the cause of a
-- signed-in person whose role cannot be read and who therefore cannot be
-- given one from admin/users.html — because that screen lists profiles,
-- and this account has none.
--
-- WHAT THIS DOES NOT DO. It does not create the missing profiles. A
-- screen that silently manufactures accounts it found by surprise is a
-- screen that hides the surprise; supabase_auth.sql section 4 already
-- carries the backfill, and running it is a deliberate act. This only
-- counts and names them.
-- ============================================================


-- ============================================================
-- 1. THE FUNCTION
-- ============================================================
/* security definer, because reading auth.users is the whole point and no
   client role may. That makes the admin check below the only thing
   standing between any signed-in account and a list of email addresses,
   so it is the first statement in the body and it raises rather than
   returns empty — a caller who is not an admin should be told no, not
   handed a convincing "there are none".

   search_path is pinned empty for the reason supabase_auth.sql gives:
   without it a definer function can be steered into calling somebody
   else's function of the same name. Every name below is qualified. */

create or replace function public.accounts_without_profile()
returns table (id uuid, email text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.my_role()) is distinct from 'admin' then
    raise exception 'Only an admin may list accounts without a profile'
      using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text, u.created_at
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
    order by u.created_at;
end;
$$;

comment on function public.accounts_without_profile() is
  'Accounts in auth.users with no row in public.profiles. Admin only; raises 42501 otherwise. Reads only, and never creates the missing profile — the backfill in supabase_auth.sql does that, deliberately.';

/* execute is granted to authenticated rather than to public: an
   anonymous caller has no role to check and no business asking. The
   admin test inside the body is what actually decides. */
revoke execute on function public.accounts_without_profile() from public, anon;
grant  execute on function public.accounts_without_profile() to authenticated;


-- ============================================================
-- 2. CHECKS
-- ============================================================

-- As an admin, expect zero rows on a healthy database.
select * from public.accounts_without_profile();

-- Who may call it. Expect `authenticated` and nothing else.
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'accounts_without_profile'
order by grantee;
