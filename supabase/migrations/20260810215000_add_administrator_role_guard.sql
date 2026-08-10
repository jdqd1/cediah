-- Keep at least one administrator while roles are managed through the API.
-- The API also checks this invariant before deleting the last administrator;
-- this trigger protects direct service-role or SQL Editor operations as well.

create or replace function private.prevent_last_administrator_removal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if old.role = 'administrator'
     and not exists (
       select 1
       from public.user_roles
       where role = 'administrator'
         and user_id <> old.user_id
     ) then
    raise exception 'last_administrator';
  end if;

  return old;
end;
$$;

revoke all on function private.prevent_last_administrator_removal() from public;

drop trigger if exists user_roles_prevent_last_administrator_removal on public.user_roles;
create trigger user_roles_prevent_last_administrator_removal
before delete on public.user_roles
for each row execute function private.prevent_last_administrator_removal();