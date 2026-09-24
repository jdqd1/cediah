-- A route can be removed together with its enrollments and student progress.
-- Published definitions stay immutable during ordinary edits and deletes.
create or replace function private.prevent_published_learning_definition_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  target_version_id uuid;
  target_path_id uuid;
begin
  if tg_table_name = 'learning_path_versions' then
    target_version_id := old.id;
    target_path_id := old.path_id;
  else
    target_version_id := old.path_version_id;
    select path_id into target_path_id
    from public.learning_path_versions where id = target_version_id;
  end if;

  if tg_op = 'DELETE'
     and target_path_id::text = current_setting('cediah.deleting_learning_path_id', true) then
    return old;
  end if;

  if exists (
    select 1 from public.learning_path_versions
    where id = target_version_id and status = 'published'
  ) then
    raise exception 'published learning path versions are immutable';
  end if;
  return old;
end;
$$;

-- The API deletes enrollments in the same transaction before removing versions.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant delete on public.learning_enrollments to cediah_runtime;
  end if;
end;
$$;
