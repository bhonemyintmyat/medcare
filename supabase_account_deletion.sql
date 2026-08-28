-- ============================================================
-- MedCare — deleting an account
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
-- Run AFTER every existing supabase_*.sql file. Safe to re-run.
--
-- This file closes the gap admin/users.html has been apologising for
-- since it was written: "Create or delete an account ... needs the
-- service_role key, which is not in this browser."
--
-- That sentence was half right. Deleting an account needs privileges
-- the browser does not have; it does not need the browser to HOLD them.
-- The same move the rest of this project already leans on works here —
-- a SECURITY DEFINER function runs as its owner rather than as the
-- caller, so the privilege lives in the database and the browser only
-- gets to ask. set_display_name() writes a column no policy allows the
-- client to write. These two delete a row in a schema the client cannot
-- even see.
--
-- What is still true, and stays true: no key in this repository can
-- delete an account directly. Everything below goes through one of two
-- named doors, and each one checks who is knocking.
--
--   delete_own_account()          anybody signed in, on themselves
--   delete_account(target_id)     an admin, on somebody else
--
-- CREATING an account is still not here, and that is not an oversight.
-- Signup already exists and belongs to the person signing up; an admin
-- creating accounts for other people means choosing their password,
-- which is a worse thing to build than a missing button.
--
-- ------------------------------------------------------------
-- WHAT A DELETION ACTUALLY DESTROYS
--
-- One `delete from auth.users`, and the foreign keys that already exist
-- do the rest. Nothing below lists tables to clean up, deliberately: a
-- hand-written cleanup list is a list that goes stale the next time
-- somebody adds a table.
--
--   auth.users            the row itself — email, password hash,
--                         sessions, refresh tokens, identities
--   public.profiles       cascade (supabase_auth.sql): name, role,
--                         locale, the copied email
--   public.bookmarks      cascade (supabase_bookmarks.sql): private
--                         saves have nobody left to belong to
--   public.reports        reporter_id -> null. The report SURVIVES.
--                         A wrong sentence on a disease page is still
--                         wrong after the person who noticed it leaves.
--   diseases, articles, hospitals, emergency_contacts, site_settings
--                         created_by / updated_by / resolved_by -> null.
--                         The CONTENT survives; only the authorship
--                         line goes blank. An editor leaving must not
--                         take the medical guidance with them.
--
-- ------------------------------------------------------------
-- WHAT IS NOT RECORDED, AND WHY
--
-- There is no deletions log. It is the obvious thing to add — every
-- other table here carries updated_by — and it is the wrong thing to
-- add: a tombstone row holding the email of somebody who asked to be
-- deleted is a copy of exactly the data the deletion was for. The one
-- fact worth keeping, "this account is gone", is already told by the
-- account being gone.
--
-- If an audit trail is ever required, it belongs in a table keyed by an
-- opaque id with no email, no name and no role, written by these
-- functions and readable only by admins. It is not this file.
-- ============================================================


-- ============================================================
-- 0. CAN THE OWNER DO THIS AT ALL
-- ============================================================
-- SECURITY DEFINER borrows the privileges of the role that OWNS the
-- function, which is whoever runs this file — `postgres` in the SQL
-- editor. `auth.users` belongs to supabase_auth_admin, and postgres is
-- granted on it in a standard Supabase project.
--
-- Where that grant is missing, both functions below parse, deploy, and
-- then fail at run time with "permission denied for table users", which
-- is a miserable way to find out. So it is checked here, loudly, before
-- anything is created. A NOTICE rather than an exception: a project
-- that needs the grant should still get the functions, ready for the
-- moment it arrives.

do $$
begin
  if not has_table_privilege(current_user, 'auth.users', 'delete') then
    raise notice
      'MedCare: % cannot delete from auth.users. Both functions in this file will deploy, and will fail when called. Run this file as postgres, or grant delete on auth.users to %.',
      current_user, current_user;
  end if;
end
$$;


-- ============================================================
-- 1. DELETING YOUR OWN ACCOUNT
-- ============================================================
-- Every signed-in person, whatever their role. A reader, an editor and
-- an admin all leave the same way, through the same door, and the door
-- takes no id argument — the account comes from the verified token, so
-- there is no field on it to point at somebody else.
--
-- Compare that with delete_account() below, which does take an id and
-- therefore spends most of its body proving the caller may use it. The
-- shape of each function is the argument it has to make.
--
-- ONE REFUSAL: the last admin. Not because the site would break —
-- Postgres would be perfectly happy — but because the only way back
-- from an admin-less MedCare is the Supabase dashboard, and the person
-- who has just deleted their account is not the person who will go and
-- find it. Promote somebody first, then leave.
--
-- WHAT THIS DOES NOT ASK FOR: the password. Supabase cannot verify one
-- without signing in again, and a re-signin mid-deletion would rotate
-- the very session the deletion is running under. What stands in its
-- place is the browser making the person type their email address —
-- weaker as proof of identity, and aimed at something else entirely.
-- The session is already proof of identity. What was missing was proof
-- of intent.

create or replace function public.delete_own_account()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := (select auth.uid());
  my_role text;
  gone_by text;
begin
  if uid is null then
    raise exception 'not_signed_in'
      using errcode = '28000',
            hint = 'Sign in again and try once more.';
  end if;

  select p.role,
         coalesce(p.display_name, p.full_name, p.username, p.email, 'your account')
    into my_role, gone_by
    from public.profiles p
   where p.id = uid;

  -- A missing profile row is not a reason to refuse. The account exists
  -- in auth.users or auth.uid() would be null, and somebody whose
  -- profile has gone missing is the person most entitled to leave.
  if not found then
    my_role := 'user';
    gone_by := 'your account';
  end if;

  if my_role = 'admin'
     and (select count(*) from public.profiles p where p.role = 'admin') <= 1 then
    raise exception 'last_admin_forbidden'
      using errcode = '42501',
            hint = 'You are the only admin. Make somebody else an admin first, then delete your account.';
  end if;

  delete from auth.users u where u.id = uid;

  return gone_by;
end;
$$;

comment on function public.delete_own_account() is
  'Deletes the calling user''s own account and everything that cascades from it. Takes no id: the account comes from the verified token. Refuses only when the caller is the last admin.';

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;


-- ============================================================
-- 2. AN ADMIN DELETING SOMEBODY ELSE
-- ============================================================
-- This one takes an id, so it has to earn it.
--
--   my_role() <> 'admin'   refused. SECURITY DEFINER means the
--                          function's own privileges are being lent
--                          out; without this line the loan is to
--                          everybody. my_role() reads the caller's
--                          STORED row, so a browser cannot claim it.
--
--   target_id = caller     refused, and pointed at delete_own_account()
--                          instead. The same shape as
--                          guard_profile_role's self-role rule, for the
--                          same reason: the mistake this screen
--                          produces is acting on the row above or below
--                          the one you meant, in a list of names that
--                          look alike. An admin who wipes themselves
--                          out that way cannot undo it, and cannot ask
--                          anybody else to undo it either.
--
--   no such profile        refused rather than reported as done. An id
--                          matching nothing usually means the list on
--                          screen is stale, and "deleted" would be a
--                          lie about a row somebody else already
--                          removed.
--
-- NOT REFUSED: deleting another admin. Allowed on purpose — otherwise
-- an admin account nobody controls any more could never be removed. The
-- last-admin case cannot arise here, because the caller is an admin
-- too, so at least one is always left standing.

create or replace function public.delete_account(target_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  gone_by text;
begin
  if caller is null then
    raise exception 'not_signed_in'
      using errcode = '28000',
            hint = 'Sign in again and try once more.';
  end if;

  if (select public.my_role()) <> 'admin' then
    raise exception 'delete_forbidden'
      using errcode = '42501',
            hint = 'Only an admin may delete somebody else''s account.';
  end if;

  if target_id is null then
    raise exception 'account_not_found'
      using errcode = 'P0002',
            hint = 'No account was named.';
  end if;

  if target_id = caller then
    raise exception 'delete_self_forbidden'
      using errcode = '42501',
            hint = 'Delete your own account from your account menu, not from the accounts list.';
  end if;

  select coalesce(p.display_name, p.full_name, p.username, p.email, 'that account')
    into gone_by
    from public.profiles p
   where p.id = target_id;

  if not found then
    raise exception 'account_not_found'
      using errcode = 'P0002',
            hint = 'No account has that id. Refresh the list.';
  end if;

  delete from auth.users u where u.id = target_id;

  return gone_by;
end;
$$;

comment on function public.delete_account(uuid) is
  'Deletes another person''s account. Admins only, and never the caller''s own — that is delete_own_account(). Returns the name the site used to call them, so the confirmation can say who is gone.';

revoke all on function public.delete_account(uuid) from public;
grant execute on function public.delete_account(uuid) to authenticated;
-- `authenticated` is every signed-in person, readers included. The
-- grant is not the check: EXECUTE gets them as far as the my_role()
-- line, which is where they stop. Granting to admins alone is not
-- possible — `admin` is a value in a column, not a Postgres role.


-- ============================================================
-- 3. THE TABLE GRANTS ARE UNCHANGED
-- ============================================================
-- Re-stated because this file is the one that widens things, and the
-- widening should be visibly bounded: DELETE on profiles stays revoked
-- from the browser. A profile still disappears only with its auth.users
-- row — which is now reachable through the two functions above, and
-- nowhere else.

revoke update, insert, delete on public.profiles from anon, authenticated;
grant update (role, display_name, full_name, locale) on public.profiles to authenticated;


-- ============================================================
-- 4. CHECKS
-- ============================================================

-- Both functions exist, and both are SECURITY DEFINER (prosecdef = t).
select p.proname, p.prosecdef, pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_own_account', 'delete_account');

-- The owner can actually do the work. Expect true; a false here is the
-- NOTICE from section 0 coming back to bite.
select pg_get_userbyid(p.proowner) as owner,
       has_table_privilege(pg_get_userbyid(p.proowner), 'auth.users', 'delete') as can_delete
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'delete_own_account';

-- Who may call them. Expect `authenticated` and nobody else — in
-- particular not `anon`, and not `public`.
select p.proname, unnest(p.proacl)::text as granted_to
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_own_account', 'delete_account');

-- Accounts and profiles stay one-to-one after any deletion (expect 0
-- rows, both ways round).
select u.id, u.email from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select p.id from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null;

-- The browser still cannot delete a profile directly (expect no DELETE
-- in the list).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profiles'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;
