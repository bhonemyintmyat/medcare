



create table if not exists public.profiles (

  id         uuid        primary key references auth.users (id) on delete cascade,


  role       text        not null default 'user'
                         check (role in ('user', 'editor', 'admin')),

  created_at timestamptz not null default now()
);

comment on table  public.profiles is 'Per-account app data. One row per auth.users row.';
comment on column public.profiles.role is 'Authorization level: user | editor | admin';




alter table public.profiles enable row level security;


create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);






create or replace function public.handle_new_user()
returns trigger
language plpgsql

security definer

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




insert into public.profiles (id, role)
select u.id, 'user' from auth.users u
on conflict (id) do nothing;





select u.id, u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;


select p.id, u.email, p.role, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at;


