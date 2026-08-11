-- ============================================================
-- MedCare — profiles table + auto-create trigger
-- Run in: Supabase dashboard -> SQL Editor -> New query -> Run
--
-- Supabase already stores accounts for you in the `auth.users` table
-- (email, encrypted password, confirmation status). You never create or
-- write that table yourself. `profiles` is YOUR table, sitting alongside
-- it, holding the things Supabase does not know about — here, the role.
-- ============================================================


-- ---------- 1. TABLE ----------

create table if not exists public.profiles (
  -- Same id as the account in auth.users, so the two are one-to-one.
  -- on delete cascade: delete the account, the profile goes with it.
  id         uuid        primary key references auth.users (id) on delete cascade,

  -- The check constraint is the last line of defence: even a bug or a
  -- direct dashboard edit cannot put an unexpected value in here.
  role       text        not null default 'user'
                         check (role in ('user', 'editor', 'admin')),

  created_at timestamptz not null default now()
);

comment on table  public.profiles is 'Per-account app data. One row per auth.users row.';
comment on column public.profiles.role is 'Authorization level: user | editor | admin';


-- ---------- 2. ROW LEVEL SECURITY ----------

alter table public.profiles enable row level security;

-- A signed-in person may read THEIR OWN row and nobody else's.
-- auth.uid() is the id of the account making the request, taken from the
-- verified JWT — the browser cannot fake it.
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- NOTE WHAT IS DELIBERATELY MISSING: there is no insert, update or delete
-- policy. That is the whole security model of this table.
--
--   * No UPDATE policy  -> nobody can run
--                            update profiles set role = 'admin'
--                          on themselves. This is the single most important
--                          line in this file. An update policy of
--                          `using (auth.uid() = id)` would look reasonable
--                          and would let EVERY user promote themselves.
--
--   * No INSERT policy  -> the browser cannot create a profile row and
--                          choose its own role at signup. Rows are created
--                          only by the trigger below.
--
-- Roles are changed by you, in the dashboard (which acts as service_role
-- and bypasses RLS), or from a trusted server. Never from the browser.


-- ---------- 3. AUTO-CREATE A PROFILE ON SIGNUP ----------
-- A trigger on auth.users fires inside the database the moment an account
-- is created, so a profile always exists. Doing this from the browser
-- instead would be both unreliable (the tab can close mid-signup) and
-- insecure (the client would get to pick the role).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
-- security definer: run as the function's owner, not as the signing-up
-- user, so the insert is allowed even though RLS grants nobody insert.
security definer
-- Pin the search_path. Without this, a SECURITY DEFINER function can be
-- tricked into calling an attacker-supplied function of the same name.
-- Because it is empty, every name below must be fully qualified.
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')          -- role is hard-coded, never taken from input
  on conflict (id) do nothing;     -- keeps signup working if the row exists
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------- 4. BACKFILL ----------
-- Gives a profile to any account that already existed before the trigger.

insert into public.profiles (id, role)
select u.id, 'user' from auth.users u
on conflict (id) do nothing;


-- ---------- 5. CHECKS ----------

-- Every account should have exactly one profile (expect 0 rows back).
select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Your accounts and their roles.
select p.id, u.email, p.role, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at;

-- To promote someone, run this here in the SQL editor (never from the app):
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
