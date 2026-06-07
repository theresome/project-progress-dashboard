create table if not exists public.user_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null default '{"projects":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  updated_at timestamptz not null default now(),
  constraint username_format check (
    char_length(username) between 3 and 24
    and username ~ '^[A-Za-z0-9_一-龥]+$'
  )
);

create unique index if not exists user_profiles_username_lower_unique
on public.user_profiles (lower(username));

alter table public.user_workspaces enable row level security;
alter table public.user_profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.user_workspaces to authenticated;
grant select, insert, update on table public.user_profiles to authenticated;

drop policy if exists "Users can read their own workspace" on public.user_workspaces;
drop policy if exists "Users can insert their own workspace" on public.user_workspaces;
drop policy if exists "Users can update their own workspace" on public.user_workspaces;
drop policy if exists "Users can delete their own workspace" on public.user_workspaces;
drop policy if exists "Users can read profiles" on public.user_profiles;
drop policy if exists "Users can insert their own profile" on public.user_profiles;
drop policy if exists "Users can update their own profile" on public.user_profiles;

create policy "Users can read their own workspace"
on public.user_workspaces for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own workspace"
on public.user_workspaces for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own workspace"
on public.user_workspaces for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own workspace"
on public.user_workspaces for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read profiles"
on public.user_profiles for select
to authenticated
using (true);

create policy "Users can insert their own profile"
on public.user_profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own profile"
on public.user_profiles for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
after insert on auth.users
for each row execute procedure public.create_profile_for_new_user();
