-- Initial CEDIAH platform foundation.
-- Browser clients receive no direct table privileges in this migration. The API
-- remains the authorization boundary until each user-facing flow has an
-- explicitly tested RLS policy.

create schema if not exists private;
revoke all on schema private from public;

create type public.platform_role as enum (
  'student',
  'presenter',
  'academic_editor',
  'coordination',
  'finance_readonly',
  'administrator'
);

create type public.course_status as enum (
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'archived'
);

create type public.lesson_kind as enum ('video', 'document', 'interactive');

create type public.resource_type as enum ('guide', 'atlas', 'worksheet', 'link');

create type public.enrollment_status as enum (
  'active',
  'paused',
  'expired',
  'revoked',
  'completed'
);

create type public.progress_status as enum ('not_started', 'in_progress', 'completed');

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  university text,
  degree_program text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 160
  ),
  constraint profiles_university_length check (
    university is null or char_length(btrim(university)) between 1 and 200
  ),
  constraint profiles_degree_program_length check (
    degree_program is null or char_length(btrim(degree_program)) between 1 and 200
  )
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.platform_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  status public.course_status not null default 'draft',
  estimated_duration_minutes integer,
  created_by uuid not null references auth.users (id) on delete restrict,
  published_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint courses_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint courses_description_length check (
    short_description is null or char_length(short_description) <= 2000
  ),
  constraint courses_duration_positive check (
    estimated_duration_minutes is null or estimated_duration_minutes >= 0
  ),
  constraint courses_publication_fields check (
    (status = 'published' and published_at is not null and published_by is not null)
    or status <> 'published'
  )
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_modules_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint course_modules_position_positive check (position > 0),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  title text not null,
  description text,
  kind public.lesson_kind not null,
  position integer not null,
  external_video_id text,
  duration_seconds integer,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint lessons_description_length check (
    description is null or char_length(description) <= 4000
  ),
  constraint lessons_position_positive check (position > 0),
  constraint lessons_duration_positive check (
    duration_seconds is null or duration_seconds >= 0
  ),
  constraint lessons_video_reference check (
    (kind = 'video' and external_video_id is not null)
    or (kind <> 'video' and external_video_id is null)
  ),
  unique (module_id, position)
);

create table public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  type public.resource_type not null,
  storage_path text,
  external_url text,
  requires_enrollment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_resources_title_length check (
    char_length(btrim(title)) between 1 and 200
  ),
  constraint course_resources_location check (
    (storage_path is not null and external_url is null)
    or (storage_path is null and external_url is not null)
  ),
  constraint course_resources_url_format check (
    external_url is null or external_url ~ '^https://'
  )
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status public.enrollment_status not null default 'active',
  access_starts_at timestamptz not null default now(),
  access_ends_at timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  grant_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_access_window check (
    access_ends_at is null or access_ends_at > access_starts_at
  ),
  constraint enrollments_grant_reason_length check (
    grant_reason is null or char_length(grant_reason) <= 1000
  ),
  unique (user_id, course_id)
);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.progress_status not null default 'not_started',
  watched_seconds integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id),
  constraint lesson_progress_watched_seconds_positive check (watched_seconds >= 0),
  constraint lesson_progress_completion_fields check (
    (status = 'completed' and completed_at is not null)
    or status <> 'completed'
  )
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint audit_log_action_length check (char_length(btrim(action)) between 1 and 120),
  constraint audit_log_target_type_length check (
    char_length(btrim(target_type)) between 1 and 120
  ),
  constraint audit_log_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index user_roles_user_id_index on public.user_roles (user_id);
create index courses_status_index on public.courses (status);
create index course_modules_course_id_index on public.course_modules (course_id);
create index lessons_module_id_index on public.lessons (module_id);
create index course_resources_course_id_index on public.course_resources (course_id);
create index course_resources_lesson_id_index on public.course_resources (lesson_id);
create index enrollments_course_id_index on public.enrollments (course_id);
create index enrollments_user_status_index on public.enrollments (user_id, status);
create index lesson_progress_lesson_id_index on public.lesson_progress (lesson_id);
create index audit_log_actor_user_id_index on public.audit_log (actor_user_id);
create index audit_log_target_index on public.audit_log (target_type, target_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger courses_set_updated_at
before update on public.courses
for each row execute function private.set_updated_at();

create trigger course_modules_set_updated_at
before update on public.course_modules
for each row execute function private.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function private.set_updated_at();

create trigger course_resources_set_updated_at
before update on public.course_resources
for each row execute function private.set_updated_at();

create trigger enrollments_set_updated_at
before update on public.enrollments
for each row execute function private.set_updated_at();

create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.course_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.courses from anon, authenticated;
revoke all on table public.course_modules from anon, authenticated;
revoke all on table public.lessons from anon, authenticated;
revoke all on table public.course_resources from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
revoke all on table public.lesson_progress from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.user_roles to service_role;
grant select, insert, update, delete on table public.courses to service_role;
grant select, insert, update, delete on table public.course_modules to service_role;
grant select, insert, update, delete on table public.lessons to service_role;
grant select, insert, update, delete on table public.course_resources to service_role;
grant select, insert, update, delete on table public.enrollments to service_role;
grant select, insert, update, delete on table public.lesson_progress to service_role;
grant select, insert, update, delete on table public.audit_log to service_role;

alter default privileges for role postgres in schema public
revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke usage, select on sequences from anon, authenticated, service_role;
