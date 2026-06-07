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
