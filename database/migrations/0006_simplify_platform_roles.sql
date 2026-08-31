-- Consolidate the historical role catalog into the four product roles.
-- Existing assignments keep the closest equivalent level of access.

lock table public.user_roles in access exclusive mode;

create temporary table migrated_user_roles on commit drop as
select distinct on (user_id, mapped_role)
  user_id,
  mapped_role,
  assigned_at,
  assigned_by
from (
  select
    user_id,
    case role::text
      when 'community_contributor' then 'content_creator'
      when 'presenter' then 'content_creator'
      when 'academic_editor' then 'coordinator'
      when 'coordination' then 'coordinator'
      when 'finance_readonly' then 'student'
      else role::text
    end as mapped_role,
    assigned_at,
    assigned_by
  from public.user_roles
) as legacy_roles
order by user_id, mapped_role, assigned_at asc;

drop trigger if exists user_roles_prevent_last_administrator_removal
on public.user_roles;

truncate table public.user_roles;

alter table public.user_roles
alter column role type text using role::text;

drop type public.platform_role;

create type public.platform_role as enum (
  'student',
  'content_creator',
  'coordinator',
  'administrator'
);

alter table public.user_roles
alter column role type public.platform_role using role::public.platform_role;

insert into public.user_roles (user_id, role, assigned_at, assigned_by)
select
  user_id,
  mapped_role::public.platform_role,
  assigned_at,
  assigned_by
from migrated_user_roles;

create trigger user_roles_prevent_last_administrator_removal
before delete on public.user_roles
for each row execute function private.prevent_last_administrator_removal();
