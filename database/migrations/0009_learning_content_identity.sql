-- Stable learning identities and private execution snapshots. This migration
-- is additive; existing publications remain catalog-visible by default.

create type public.catalog_visibility as enum ('catalog', 'guided_only');

alter table public.content_items
add column catalog_visibility public.catalog_visibility not null default 'catalog';

create index content_items_visibility_status_published_index
on public.content_items (catalog_visibility, status, published_at desc);

-- Add missing IDs once while preserving every existing text, option, answer
-- and array position. Invalid pre-existing identity fields fail the migration
-- instead of being silently replaced.
create or replace function private.normalize_learning_content_identity(
  source_content jsonb,
  source_kind public.content_kind
)
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog, public, private
as $$
declare
  cards jsonb;
  normalized jsonb := source_content;
  normalized_entries jsonb := '[]'::jsonb;
  entry jsonb;
  option_count integer;
  option_ids jsonb;
  questions jsonb;
  questions_path text[];
begin
  if source_kind = 'flashcards' then
    cards := coalesce(source_content -> 'cards', '[]'::jsonb);
    if jsonb_typeof(cards) <> 'array' then
      raise exception 'flashcard content must contain an array of cards';
    end if;
    for entry in select value from jsonb_array_elements(cards)
    loop
      if entry ? 'id' then
        perform (entry ->> 'id')::uuid;
      else
        entry := entry || jsonb_build_object('id', gen_random_uuid());
      end if;
      if entry ? 'memoryVersion' then
        if jsonb_typeof(entry -> 'memoryVersion') <> 'number'
          or (entry ->> 'memoryVersion')::integer < 1 then
          raise exception 'flashcard memoryVersion must be a positive integer';
        end if;
      else
        entry := entry || jsonb_build_object('memoryVersion', 1);
      end if;
      normalized_entries := normalized_entries || jsonb_build_array(entry);
    end loop;
    return jsonb_set(normalized, '{cards}', normalized_entries, true);
  end if;

  if source_kind = 'quiz' then
    questions_path := array['questions'];
  elsif source_kind in ('video', 'guide') then
    questions_path := array['quiz', 'questions'];
  else
    return source_content;
  end if;

  questions := coalesce(source_content #> questions_path, '[]'::jsonb);
  if jsonb_typeof(questions) <> 'array' then
    raise exception 'learning content must contain an array of questions';
  end if;

  for entry in select value from jsonb_array_elements(questions)
  loop
    if entry ? 'id' then
      perform (entry ->> 'id')::uuid;
    else
      entry := entry || jsonb_build_object('id', gen_random_uuid());
    end if;
    if entry ? 'memoryVersion' then
      if jsonb_typeof(entry -> 'memoryVersion') <> 'number'
        or (entry ->> 'memoryVersion')::integer < 1 then
        raise exception 'question memoryVersion must be a positive integer';
      end if;
    else
      entry := entry || jsonb_build_object('memoryVersion', 1);
    end if;

    option_count := jsonb_array_length(coalesce(entry -> 'options', '[]'::jsonb));
    if option_count < 2 then
      raise exception 'question must contain at least two options';
    end if;
    if entry ? 'optionIds' then
      option_ids := entry -> 'optionIds';
      if jsonb_typeof(option_ids) <> 'array'
        or jsonb_array_length(option_ids) <> option_count then
        raise exception 'optionIds must match question options';
      end if;
      if (
        select count(*) <> count(distinct value)
        from jsonb_array_elements_text(option_ids)
      ) then
        raise exception 'optionIds must be unique';
      end if;
      perform value::uuid from jsonb_array_elements_text(option_ids);
    else
      select coalesce(jsonb_agg(to_jsonb(gen_random_uuid())), '[]'::jsonb)
      into option_ids
      from generate_series(1, option_count);
      entry := entry || jsonb_build_object('optionIds', option_ids);
    end if;
    normalized_entries := normalized_entries || jsonb_build_array(entry);
  end loop;

  return jsonb_set(normalized, questions_path, normalized_entries, true);
end;
$$;

do $$
declare
  item record;
  normalized jsonb;
begin
  for item in
    select id, kind, content
    from public.content_items
    where kind in ('video', 'guide', 'quiz', 'flashcards')
    order by id
    for update
  loop
    normalized := private.normalize_learning_content_identity(item.content, item.kind);
    if normalized is distinct from item.content then
      update public.content_items
      set content = normalized, version = version + 1
      where id = item.id;

      insert into public.audit_log (
        actor_user_id,
        action,
        target_type,
        target_id,
        metadata
      ) values (
        null,
        'learning_content_identity_normalized',
        'content_item',
        item.id,
        jsonb_build_object('preservedEditorialContent', true)
      );
    end if;
  end loop;
end;
$$;

create table public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  source_content_id uuid not null references public.content_items (id) on delete restrict,
  projection text not null check (projection in ('video', 'guide', 'quiz', 'flashcards')),
  adapter_key text not null check (char_length(btrim(adapter_key)) between 1 and 80),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_content_id, projection)
);

create table public.learning_items (
  id uuid primary key,
  source_content_id uuid not null references public.content_items (id) on delete restrict,
  item_kind text not null check (item_kind in ('question', 'flashcard')),
  memory_version integer not null default 1 check (memory_version > 0),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, source_content_id, memory_version)
);

create table public.learning_resource_revisions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.learning_resources (id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  source_version integer not null check (source_version > 0),
  adapter_version integer not null check (adapter_version > 0),
  schema_version integer not null check (schema_version > 0),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  payload_hash text not null check (char_length(payload_hash) = 64),
  created_at timestamptz not null default now(),
  unique (resource_id, revision_number),
  unique (resource_id, source_version, adapter_version, payload_hash)
);

create index learning_resources_source_index
on public.learning_resources (source_content_id, projection);
create index learning_items_source_index
on public.learning_items (source_content_id, item_kind);
create index learning_resource_revisions_resource_index
on public.learning_resource_revisions (resource_id, revision_number desc);

create trigger learning_items_set_updated_at
before update on public.learning_items
for each row execute function private.set_updated_at();

create or replace function private.prevent_learning_revision_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  raise exception 'learning resource revisions are immutable';
end;
$$;

create trigger learning_resource_revisions_are_immutable
before update or delete on public.learning_resource_revisions
for each row execute function private.prevent_learning_revision_mutation();

alter table public.learning_resources enable row level security;
alter table public.learning_items enable row level security;
alter table public.learning_resource_revisions enable row level security;
revoke all on public.learning_resources, public.learning_items,
  public.learning_resource_revisions from public;

do $$
declare
  inherited_grantee text;
begin
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid in (
      'public.learning_resources'::regclass,
      'public.learning_items'::regclass,
      'public.learning_resource_revisions'::regclass
    )
      and privileges.grantee <> tables.relowner
  loop
    execute format(
      'revoke all on public.learning_resources, public.learning_items, public.learning_resource_revisions from %I',
      inherited_grantee
    );
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update on public.learning_resources to cediah_runtime;
    grant select, insert, update on public.learning_items to cediah_runtime;
    grant select, insert on public.learning_resource_revisions to cediah_runtime;
    create policy learning_resources_runtime on public.learning_resources
      to cediah_runtime using (true) with check (true);
    create policy learning_items_runtime on public.learning_items
      to cediah_runtime using (true) with check (true);
    create policy learning_resource_revisions_runtime on public.learning_resource_revisions
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
