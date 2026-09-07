-- Persistent guided-learning attempts, responses and route progress. This
-- domain intentionally does not reuse watched_seconds or client-only state.

create table public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_users (id) on delete cascade,
  client_attempt_id uuid not null,
  enrollment_id uuid,
  path_version_id uuid,
  step_id uuid,
  step_option_id uuid,
  purpose text not null check (purpose in ('understand', 'recall', 'check', 'integrate', 'diagnostic')),
  projection text not null check (projection in ('video', 'guide', 'quiz', 'flashcards')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  manifest_json jsonb not null,
  resume_json jsonb not null default '{"answeredItemIds":[],"currentIndex":0,"guidePosition":null,"observedRanges":[],"ratedItemIds":[],"revealedItemIds":[],"videoPositionSeconds":null}'::jsonb,
  score_json jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_attempt_id),
  unique (id, user_id),
  foreign key (enrollment_id, path_version_id)
    references public.learning_enrollment_versions (enrollment_id, path_version_id) on delete cascade,
  foreign key (step_id, path_version_id)
    references public.learning_path_steps (id, path_version_id) on delete restrict,
  foreign key (step_option_id, path_version_id)
    references public.learning_step_options (id, path_version_id) on delete restrict,
  constraint learning_attempts_context_complete check (
    (enrollment_id is null and path_version_id is null and step_id is null and step_option_id is null)
    or
    (enrollment_id is not null and path_version_id is not null and step_id is not null and step_option_id is not null)
  ),
  constraint learning_attempts_manifest_object check (jsonb_typeof(manifest_json) = 'object'),
  constraint learning_attempts_resume_object check (jsonb_typeof(resume_json) = 'object'),
  constraint learning_attempts_score_object check (score_json is null or jsonb_typeof(score_json) = 'object'),
  constraint learning_attempts_submission_state check (
    (status = 'completed' and submitted_at is not null)
    or (status <> 'completed' and submitted_at is null)
  )
);

create table public.learning_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.learning_attempts (id) on delete cascade,
  item_id uuid not null references public.learning_items (id) on delete restrict,
  memory_version integer not null check (memory_version > 0),
  round integer not null default 1 check (round > 0 and round <= 10),
  answer_json jsonb not null,
  grading_json jsonb not null,
  schedule_applied boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, item_id, round),
  constraint learning_responses_answer_object check (jsonb_typeof(answer_json) = 'object'),
  constraint learning_responses_grading_object check (jsonb_typeof(grading_json) = 'object')
);

create table public.learning_step_progress (
  enrollment_id uuid not null,
  step_id uuid not null,
  path_version_id uuid not null,
  state text not null default 'not_started' check (state in ('not_started', 'in_progress', 'completed', 'skipped')),
  completion_method text check (completion_method in ('graded', 'observed', 'rated', 'self_reported')),
  completed_at timestamptz,
  evidence_attempt_id uuid references public.learning_attempts (id) on delete set null,
  row_version integer not null default 1 check (row_version > 0),
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, step_id),
  foreign key (enrollment_id, path_version_id)
    references public.learning_enrollment_versions (enrollment_id, path_version_id) on delete cascade,
  foreign key (step_id, path_version_id)
    references public.learning_path_steps (id, path_version_id) on delete restrict,
  constraint learning_step_progress_completion_fields check (
    (state = 'completed' and completed_at is not null and completion_method is not null)
    or (state <> 'completed' and completed_at is null and completion_method is null)
  )
);

create table public.learning_mutation_receipts (
  user_id uuid not null references public.auth_users (id) on delete cascade,
  idempotency_key uuid not null,
  request_hash char(64) not null,
  response_json jsonb,
  http_status integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  primary key (user_id, idempotency_key),
  constraint learning_mutation_receipts_response_object check (
    response_json is null or jsonb_typeof(response_json) = 'object'
  ),
  constraint learning_mutation_receipts_http_status check (
    http_status is null or http_status between 200 and 599
  )
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_users (id) on delete cascade,
  event_type text not null,
  semantic_key text not null,
  attempt_id uuid references public.learning_attempts (id) on delete cascade,
  enrollment_id uuid references public.learning_enrollments (id) on delete cascade,
  occurred_at timestamptz not null default now(),
  local_date date not null default (now() at time zone 'UTC')::date,
  timezone text not null default 'UTC',
  payload_json jsonb not null default '{}'::jsonb,
  policy_version text not null default 'guided-v1',
  unique (user_id, semantic_key),
  constraint learning_events_type_length check (char_length(btrim(event_type)) between 1 and 80),
  constraint learning_events_key_length check (char_length(btrim(semantic_key)) between 1 and 300),
  constraint learning_events_payload_object check (jsonb_typeof(payload_json) = 'object')
);

create index learning_attempts_user_recent_index
on public.learning_attempts (user_id, status, updated_at desc);
create index learning_attempts_enrollment_step_index
on public.learning_attempts (enrollment_id, step_id, status, updated_at desc);
create index learning_responses_attempt_index
on public.learning_responses (attempt_id, answered_at, id);
create index learning_responses_item_index
on public.learning_responses (item_id, memory_version, answered_at desc);
create index learning_step_progress_version_index
on public.learning_step_progress (enrollment_id, path_version_id, state);
create index learning_mutation_receipts_expiry_index
on public.learning_mutation_receipts (expires_at);
create index learning_events_user_date_index
on public.learning_events (user_id, local_date desc, occurred_at desc);

create or replace function private.prevent_learning_attempt_manifest_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  if new.manifest_json is distinct from old.manifest_json
     or new.user_id is distinct from old.user_id
     or new.client_attempt_id is distinct from old.client_attempt_id
     or new.enrollment_id is distinct from old.enrollment_id
     or new.path_version_id is distinct from old.path_version_id
     or new.step_id is distinct from old.step_id
     or new.step_option_id is distinct from old.step_option_id
     or new.projection is distinct from old.projection then
    raise exception 'learning attempt manifest and context are immutable';
  end if;
  return new;
end;
$$;

create trigger learning_attempts_manifest_immutable
before update on public.learning_attempts
for each row execute function private.prevent_learning_attempt_manifest_mutation();

create or replace function private.prevent_learning_response_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  raise exception 'learning responses are immutable';
end;
$$;

create trigger learning_responses_immutable
before update or delete on public.learning_responses
for each row execute function private.prevent_learning_response_mutation();

create trigger learning_attempts_set_updated_at
before update on public.learning_attempts
for each row execute function private.set_updated_at();
create trigger learning_step_progress_set_updated_at
before update on public.learning_step_progress
for each row execute function private.set_updated_at();

alter table public.learning_attempts enable row level security;
alter table public.learning_responses enable row level security;
alter table public.learning_step_progress enable row level security;
alter table public.learning_mutation_receipts enable row level security;
alter table public.learning_events enable row level security;

revoke all on public.learning_attempts, public.learning_responses,
  public.learning_step_progress, public.learning_mutation_receipts,
  public.learning_events from public;

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
      'public.learning_attempts'::regclass,
      'public.learning_responses'::regclass,
      'public.learning_step_progress'::regclass,
      'public.learning_mutation_receipts'::regclass,
      'public.learning_events'::regclass
    ) and privileges.grantee <> tables.relowner
  loop
    execute format(
      'revoke all on public.learning_attempts, public.learning_responses, public.learning_step_progress, public.learning_mutation_receipts, public.learning_events from %I',
      inherited_grantee
    );
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update on public.learning_attempts,
      public.learning_step_progress, public.learning_mutation_receipts to cediah_runtime;
    grant select, insert on public.learning_responses, public.learning_events to cediah_runtime;

    create policy learning_attempts_runtime on public.learning_attempts
      to cediah_runtime using (true) with check (true);
    create policy learning_responses_runtime on public.learning_responses
      to cediah_runtime using (true) with check (true);
    create policy learning_step_progress_runtime on public.learning_step_progress
      to cediah_runtime using (true) with check (true);
    create policy learning_mutation_receipts_runtime on public.learning_mutation_receipts
      to cediah_runtime using (true) with check (true);
    create policy learning_events_runtime on public.learning_events
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
