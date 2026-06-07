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

-- Team collaboration
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  description text not null default '',
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'manager', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, invited_user_id)
);

create table if not exists public.team_workspaces (
  team_id uuid primary key references public.teams(id) on delete cascade,
  workspace jsonb not null default '{"projects":[]}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_team(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.can_edit_team(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and role in ('owner', 'manager', 'member')
  );
$$;

create or replace function public.is_invited_to_team(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.team_invitations
    where team_id = target_team_id
      and invited_user_id = auth.uid()
      and status = 'pending'
  );
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_workspaces enable row level security;

grant select on public.teams, public.team_members, public.team_invitations, public.team_workspaces to authenticated;
grant insert, update, delete on public.teams, public.team_members, public.team_invitations, public.team_workspaces to authenticated;
grant execute on function public.is_team_member(uuid), public.can_manage_team(uuid), public.can_edit_team(uuid), public.is_invited_to_team(uuid) to authenticated;

drop policy if exists "Members can view teams" on public.teams;
drop policy if exists "Members can view memberships" on public.team_members;
drop policy if exists "Users can view their invitations" on public.team_invitations;
drop policy if exists "Members can view team workspace" on public.team_workspaces;
drop policy if exists "Editors can update team workspace" on public.team_workspaces;

create policy "Members can view teams"
on public.teams for select to authenticated
using (public.is_team_member(id) or public.is_invited_to_team(id));

create policy "Members can view memberships"
on public.team_members for select to authenticated
using (public.is_team_member(team_id));

create policy "Users can view their invitations"
on public.team_invitations for select to authenticated
using (invited_user_id = auth.uid() or public.can_manage_team(team_id));

create policy "Members can view team workspace"
on public.team_workspaces for select to authenticated
using (public.is_team_member(team_id));

create policy "Editors can update team workspace"
on public.team_workspaces for update to authenticated
using (public.can_edit_team(team_id))
with check (public.can_edit_team(team_id));

create or replace function public.create_team(team_name text, team_description text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
begin
  insert into public.teams (name, description, owner_id)
  values (trim(team_name), coalesce(trim(team_description), ''), auth.uid())
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, role)
  values (new_team_id, auth.uid(), 'owner');

  insert into public.team_workspaces (team_id, updated_by)
  values (new_team_id, auth.uid());

  return new_team_id;
end;
$$;

create or replace function public.join_team_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team_id uuid;
begin
  select id into target_team_id from public.teams where invite_code = upper(trim(code));
  if target_team_id is null then
    raise exception '邀请码无效';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (target_team_id, auth.uid(), 'member')
  on conflict (team_id, user_id) do nothing;
  return target_team_id;
end;
$$;

create or replace function public.invite_user_to_team(target_team_id uuid, target_username text, member_role text default 'member')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  invitation_id uuid;
begin
  if not public.can_manage_team(target_team_id) then
    raise exception '没有邀请成员的权限';
  end if;
  if member_role not in ('member', 'viewer') then
    raise exception '邀请角色无效';
  end if;
  select user_id into target_user_id from public.user_profiles where lower(username) = lower(trim(target_username));
  if target_user_id is null then
    raise exception '未找到该用户名';
  end if;
  if exists (select 1 from public.team_members where team_id = target_team_id and user_id = target_user_id) then
    raise exception '该用户已经在小组中';
  end if;
  insert into public.team_invitations (team_id, invited_user_id, invited_by, role, status)
  values (target_team_id, target_user_id, auth.uid(), member_role, 'pending')
  on conflict (team_id, invited_user_id)
  do update set invited_by = auth.uid(), role = excluded.role, status = 'pending', created_at = now()
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.respond_to_team_invitation(invitation_id uuid, accept_invitation boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.team_invitations%rowtype;
begin
  select * into invitation from public.team_invitations
  where id = invitation_id and invited_user_id = auth.uid() and status = 'pending';
  if invitation.id is null then
    raise exception '邀请不存在或已处理';
  end if;
  update public.team_invitations
  set status = case when accept_invitation then 'accepted' else 'declined' end
  where id = invitation.id;
  if accept_invitation then
    insert into public.team_members (team_id, user_id, role)
    values (invitation.team_id, auth.uid(), invitation.role)
    on conflict (team_id, user_id) do nothing;
  end if;
  return invitation.team_id;
end;
$$;

create or replace function public.regenerate_team_invite_code(target_team_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
begin
  if not public.can_manage_team(target_team_id) then
    raise exception '没有管理邀请码的权限';
  end if;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.teams set invite_code = new_code where id = target_team_id;
  return new_code;
end;
$$;

revoke execute on function public.create_team(text, text) from public;
revoke execute on function public.join_team_by_code(text) from public;
revoke execute on function public.invite_user_to_team(uuid, text, text) from public;
revoke execute on function public.respond_to_team_invitation(uuid, boolean) from public;
revoke execute on function public.regenerate_team_invite_code(uuid) from public;
grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;
grant execute on function public.invite_user_to_team(uuid, text, text) to authenticated;
grant execute on function public.respond_to_team_invitation(uuid, boolean) to authenticated;
grant execute on function public.regenerate_team_invite_code(uuid) to authenticated;
