select
  to_regclass('public.user_workspaces') as workspace_table,
  has_table_privilege('authenticated', 'public.user_workspaces', 'select') as can_select,
  has_table_privilege('authenticated', 'public.user_workspaces', 'insert') as can_insert,
  has_table_privilege('authenticated', 'public.user_workspaces', 'update') as can_update,
  has_table_privilege('authenticated', 'public.user_workspaces', 'delete') as can_delete;

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'user_workspaces'
order by cmd;

select
  to_regclass('public.user_profiles') as profiles_table,
  has_table_privilege('authenticated', 'public.user_profiles', 'select') as can_select,
  has_table_privilege('authenticated', 'public.user_profiles', 'insert') as can_insert,
  has_table_privilege('authenticated', 'public.user_profiles', 'update') as can_update;

select
  to_regclass('public.teams') as teams_table,
  to_regclass('public.team_members') as members_table,
  to_regclass('public.team_invitations') as invitations_table,
  to_regclass('public.team_workspaces') as team_workspaces_table,
  has_function_privilege('authenticated', 'public.create_team(text,text)', 'execute') as can_create_team,
  has_function_privilege('authenticated', 'public.join_team_by_code(text)', 'execute') as can_join_team;
