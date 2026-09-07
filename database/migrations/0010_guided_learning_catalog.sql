-- Versioned guided-learning paths and enrollment pinning. Student state is
-- intentionally separate from the legacy course/watched-seconds domain.

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  topic_content_id uuid not null references public.content_items (id) on delete restrict,
  slug text not null unique,
  title text not null,
  summary text not null,
  cover_asset_id uuid references public.content_assets (id) on delete restrict,
  cover_key text,
  created_by uuid not null references public.auth_users (id) on delete restrict,
  published_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_paths_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint learning_paths_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint learning_paths_summary_length check (char_length(btrim(summary)) between 1 and 2000),
  constraint learning_paths_cover_present check (
    (cover_asset_id is not null)::integer + (cover_key is not null)::integer = 1
  ),
  constraint learning_paths_cover_key_allowed check (
    cover_key is null or cover_key in (
      'back-muscles', 'heart', 'intestines', 'lungs',
      'neck-muscles', 'pelvis', 'skull', 'thigh'
    )
  )
);

create table public.learning_path_versions (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.learning_paths (id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status public.course_status not null default 'draft',
  edit_version integer not null default 1 check (edit_version > 0),
  policy_version text not null,
  policy_json jsonb not null default '{}'::jsonb,
  release_notes text not null default '',
  published_at timestamptz,
  published_by uuid references public.auth_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (path_id, version_number),
  unique (id, path_id),
  constraint learning_path_versions_policy_length check (
    char_length(btrim(policy_version)) between 1 and 80
  ),
  constraint learning_path_versions_policy_object check (jsonb_typeof(policy_json) = 'object'),
  constraint learning_path_versions_release_notes_length check (char_length(release_notes) <= 4000),
  constraint learning_path_versions_publication_fields check (
    (status = 'published' and published_at is not null and published_by is not null)
    or status <> 'published'
  )
);

alter table public.learning_paths
add constraint learning_paths_published_version_belongs_to_path
foreign key (published_version_id, id)
references public.learning_path_versions (id, path_id)
on delete restrict
deferrable initially deferred;

create table public.learning_path_units (
  id uuid primary key default gen_random_uuid(),
  path_version_id uuid not null references public.learning_path_versions (id) on delete cascade,
  stable_key text not null,
  pedagogy_version integer not null default 1 check (pedagogy_version > 0),
  title text not null,
  position integer not null check (position >= 0),
  objectives_json jsonb not null default '[]'::jsonb,
  unique (path_version_id, stable_key),
  unique (path_version_id, position),
  unique (id, path_version_id),
  constraint learning_path_units_stable_key_format check (
    stable_key ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$'
  ),
  constraint learning_path_units_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint learning_path_units_objectives_array check (jsonb_typeof(objectives_json) = 'array')
);

create table public.learning_path_steps (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  path_version_id uuid not null,
  stable_key text not null,
  pedagogy_version integer not null default 1 check (pedagogy_version > 0),
  title text not null,
  position integer not null check (position >= 0),
  is_essential boolean not null default true,
  purpose text not null check (purpose in ('understand', 'recall', 'check', 'integrate', 'diagnostic')),
  objective_ids_json jsonb not null default '[]'::jsonb,
  recommended_after_json jsonb not null default '[]'::jsonb,
  foreign key (unit_id, path_version_id)
    references public.learning_path_units (id, path_version_id) on delete cascade,
  unique (path_version_id, stable_key),
  unique (unit_id, position),
  unique (id, path_version_id),
  constraint learning_path_steps_stable_key_format check (
    stable_key ~ '^[a-z0-9]+(?:[-_][a-z0-9]+)*$'
  ),
  constraint learning_path_steps_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint learning_path_steps_objective_ids_array check (jsonb_typeof(objective_ids_json) = 'array'),
  constraint learning_path_steps_recommended_after_array check (jsonb_typeof(recommended_after_json) = 'array')
);

create table public.learning_step_options (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null,
  path_version_id uuid not null,
  resource_revision_id uuid not null references public.learning_resource_revisions (id) on delete restrict,
  source_content_id uuid not null references public.content_items (id) on delete restrict,
  projection text not null check (projection in ('video', 'guide', 'quiz', 'flashcards')),
  label text not null,
  position integer not null check (position >= 0),
  is_default boolean not null default false,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  config_json jsonb not null default '{}'::jsonb,
  completion_rule_json jsonb not null default '{}'::jsonb,
  reward_identity uuid not null,
  reward_version integer not null default 1 check (reward_version > 0),
  foreign key (step_id, path_version_id)
    references public.learning_path_steps (id, path_version_id) on delete cascade,
  unique (id, path_version_id),
  unique (step_id, position),
  constraint learning_step_options_label_length check (char_length(btrim(label)) between 1 and 120),
  constraint learning_step_options_config_object check (jsonb_typeof(config_json) = 'object'),
  constraint learning_step_options_completion_rule_object check (jsonb_typeof(completion_rule_json) = 'object')
);

create unique index learning_step_options_one_default_index
on public.learning_step_options (step_id)
where is_default;

create table public.learning_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_users (id) on delete cascade,
  path_id uuid not null,
  path_version_id uuid not null,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (path_version_id, path_id)
    references public.learning_path_versions (id, path_id) on delete restrict,
  unique (user_id, path_id),
  unique (id, path_id)
);

create table public.learning_enrollment_versions (
  enrollment_id uuid not null,
  path_id uuid not null,
  path_version_id uuid not null,
  adopted_at timestamptz not null default now(),
  previous_version_id uuid,
  mapping_json jsonb not null default '{}'::jsonb,
  primary key (enrollment_id, path_version_id),
  foreign key (enrollment_id, path_id)
    references public.learning_enrollments (id, path_id) on delete cascade,
  foreign key (path_version_id, path_id)
    references public.learning_path_versions (id, path_id) on delete restrict,
  foreign key (previous_version_id, path_id)
    references public.learning_path_versions (id, path_id) on delete restrict,
  constraint learning_enrollment_versions_mapping_object check (jsonb_typeof(mapping_json) = 'object')
);

create or replace function private.validate_learning_topic()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from public.content_items
    where id = new.topic_content_id and kind = 'topic'
  ) then
    raise exception 'learning path topic_content_id must reference topic content';
  end if;
  return new;
end;
$$;

create trigger learning_paths_require_topic
before insert or update of topic_content_id on public.learning_paths
for each row execute function private.validate_learning_topic();

create or replace function private.prevent_published_learning_definition_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  target_version_id uuid;
begin
  if tg_table_name = 'learning_path_versions' then
    target_version_id := old.id;
  else
    target_version_id := old.path_version_id;
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

create trigger learning_path_versions_published_immutable
before update or delete on public.learning_path_versions
for each row when (old.status = 'published')
execute function private.prevent_published_learning_definition_mutation();
create trigger learning_path_units_published_immutable
before update or delete on public.learning_path_units
for each row execute function private.prevent_published_learning_definition_mutation();
create trigger learning_path_steps_published_immutable
before update or delete on public.learning_path_steps
for each row execute function private.prevent_published_learning_definition_mutation();
create trigger learning_step_options_published_immutable
before update or delete on public.learning_step_options
for each row execute function private.prevent_published_learning_definition_mutation();

create or replace function private.validate_active_learning_version_adopted()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from public.learning_enrollment_versions
    where enrollment_id = new.id and path_version_id = new.path_version_id
  ) then
    raise exception 'active learning path version must be adopted by enrollment';
  end if;
  return null;
end;
$$;

create constraint trigger learning_enrollments_active_version_adopted
after insert or update of path_version_id on public.learning_enrollments
deferrable initially deferred
for each row execute function private.validate_active_learning_version_adopted();

create index learning_paths_topic_published_index
on public.learning_paths (topic_content_id, published_version_id, id);
create index learning_path_versions_path_status_index
on public.learning_path_versions (path_id, status, version_number desc);
create index learning_path_steps_unit_position_index
on public.learning_path_steps (unit_id, position);
create index learning_step_options_revision_index
on public.learning_step_options (resource_revision_id);
create index learning_enrollments_user_activity_index
on public.learning_enrollments (user_id, status, last_activity_at desc);
create index learning_enrollment_versions_version_index
on public.learning_enrollment_versions (path_version_id);

create trigger learning_paths_set_updated_at
before update on public.learning_paths
for each row execute function private.set_updated_at();
create trigger learning_path_versions_set_updated_at
before update on public.learning_path_versions
for each row execute function private.set_updated_at();
create trigger learning_enrollments_set_updated_at
before update on public.learning_enrollments
for each row execute function private.set_updated_at();

alter table public.learning_paths enable row level security;
alter table public.learning_path_versions enable row level security;
alter table public.learning_path_units enable row level security;
alter table public.learning_path_steps enable row level security;
alter table public.learning_step_options enable row level security;
alter table public.learning_enrollments enable row level security;
alter table public.learning_enrollment_versions enable row level security;

revoke all on public.learning_paths, public.learning_path_versions,
  public.learning_path_units, public.learning_path_steps,
  public.learning_step_options, public.learning_enrollments,
  public.learning_enrollment_versions from public;

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
      'public.learning_paths'::regclass,
      'public.learning_path_versions'::regclass,
      'public.learning_path_units'::regclass,
      'public.learning_path_steps'::regclass,
      'public.learning_step_options'::regclass,
      'public.learning_enrollments'::regclass,
      'public.learning_enrollment_versions'::regclass
    ) and privileges.grantee <> tables.relowner
  loop
    execute format(
      'revoke all on public.learning_paths, public.learning_path_versions, public.learning_path_units, public.learning_path_steps, public.learning_step_options, public.learning_enrollments, public.learning_enrollment_versions from %I',
      inherited_grantee
    );
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update, delete on public.learning_paths,
      public.learning_path_versions, public.learning_path_units,
      public.learning_path_steps, public.learning_step_options to cediah_runtime;
    grant select, insert, update on public.learning_enrollments to cediah_runtime;
    grant select, insert on public.learning_enrollment_versions to cediah_runtime;

    create policy learning_paths_runtime on public.learning_paths
      to cediah_runtime using (true) with check (true);
    create policy learning_path_versions_runtime on public.learning_path_versions
      to cediah_runtime using (true) with check (true);
    create policy learning_path_units_runtime on public.learning_path_units
      to cediah_runtime using (true) with check (true);
    create policy learning_path_steps_runtime on public.learning_path_steps
      to cediah_runtime using (true) with check (true);
    create policy learning_step_options_runtime on public.learning_step_options
      to cediah_runtime using (true) with check (true);
    create policy learning_enrollments_runtime on public.learning_enrollments
      to cediah_runtime using (true) with check (true);
    create policy learning_enrollment_versions_runtime on public.learning_enrollment_versions
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
