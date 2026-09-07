-- Deterministic memory, objective evidence and recommendation preferences.
-- Scientific due dates remain separate from presentation-only task overrides.

alter table public.learning_attempts
drop constraint learning_attempts_projection_check;

alter table public.learning_attempts
add constraint learning_attempts_projection_check
check (projection in ('video', 'guide', 'quiz', 'flashcards', 'review'));

alter table public.learning_attempts
add constraint learning_attempts_projection_context_check check (
  (projection = 'review' and enrollment_id is null and path_version_id is null
    and step_id is null and step_option_id is null)
  or
  (projection <> 'review' and enrollment_id is not null and path_version_id is not null
    and step_id is not null and step_option_id is not null)
);

create table public.learning_review_states (
  user_id uuid not null references public.auth_users (id) on delete cascade,
  item_id uuid not null references public.learning_items (id) on delete restrict,
  memory_version integer not null check (memory_version > 0),
  stage integer not null default 0 check (stage between 0 and 4),
  next_due_at timestamptz not null,
  last_reviewed_at timestamptz,
  lapses integer not null default 0 check (lapses >= 0),
  row_version integer not null default 1 check (row_version > 0),
  policy_version text not null default 'scheduler-v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id, memory_version),
  constraint learning_review_states_policy_length check (
    char_length(btrim(policy_version)) between 1 and 80
  )
);

create table public.learning_objective_progress (
  enrollment_id uuid not null,
  path_version_id uuid not null,
  objective_id uuid not null,
  evidence_state text not null default 'unassessed'
    check (evidence_state in ('unassessed', 'practicing', 'developing', 'consolidated')),
  evidence_json jsonb not null default '{}'::jsonb,
  last_assessed_at timestamptz,
  policy_version text not null default 'evidence-v1',
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, path_version_id, objective_id),
  foreign key (enrollment_id, path_version_id)
    references public.learning_enrollment_versions (enrollment_id, path_version_id) on delete cascade,
  constraint learning_objective_progress_evidence_object check (jsonb_typeof(evidence_json) = 'object'),
  constraint learning_objective_progress_policy_length check (
    char_length(btrim(policy_version)) between 1 and 80
  )
);

create table public.learning_preferences (
  user_id uuid primary key references public.auth_users (id) on delete cascade,
  timezone text not null default 'UTC',
  session_minutes integer not null default 10 check (session_minutes in (5, 10, 20)),
  weekly_goal_days integer check (weekly_goal_days in (2, 3, 5)),
  pinned_enrollment_id uuid references public.learning_enrollments (id) on delete set null,
  exam_date date,
  pending_preferences_json jsonb not null default '{}'::jsonb,
  row_version integer not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_preferences_timezone_length check (char_length(btrim(timezone)) between 1 and 80),
  constraint learning_preferences_pending_object check (jsonb_typeof(pending_preferences_json) = 'object')
);

create table public.learning_task_overrides (
  user_id uuid not null references public.auth_users (id) on delete cascade,
  task_key text not null,
  enrollment_id uuid references public.learning_enrollments (id) on delete cascade,
  action text not null check (action in ('snooze', 'dismiss', 'pin')),
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_key),
  constraint learning_task_overrides_key_length check (char_length(btrim(task_key)) between 1 and 300),
  constraint learning_task_overrides_snooze_fields check (
    (action = 'snooze' and snoozed_until is not null)
    or (action <> 'snooze' and snoozed_until is null)
  )
);

create or replace function private.validate_learning_user_enrollment()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  selected_enrollment uuid;
begin
  selected_enrollment := case
    when tg_table_name = 'learning_preferences'
      then nullif(to_jsonb(new)->>'pinned_enrollment_id', '')::uuid
    else nullif(to_jsonb(new)->>'enrollment_id', '')::uuid
  end;
  if selected_enrollment is not null and not exists (
    select 1 from public.learning_enrollments
    where id = selected_enrollment and user_id = new.user_id
  ) then
    raise exception 'learning enrollment must belong to preference owner';
  end if;
  return new;
end;
$$;

create trigger learning_preferences_validate_enrollment
before insert or update on public.learning_preferences
for each row execute function private.validate_learning_user_enrollment();

create trigger learning_task_overrides_validate_enrollment
before insert or update on public.learning_task_overrides
for each row execute function private.validate_learning_user_enrollment();

create trigger learning_review_states_set_updated_at
before update on public.learning_review_states
for each row execute function private.set_updated_at();

create trigger learning_preferences_set_updated_at
before update on public.learning_preferences
for each row execute function private.set_updated_at();

create trigger learning_task_overrides_set_updated_at
before update on public.learning_task_overrides
for each row execute function private.set_updated_at();

create index learning_review_states_due_index
on public.learning_review_states (user_id, next_due_at, item_id, memory_version);
create index learning_objective_progress_enrollment_index
on public.learning_objective_progress (enrollment_id, path_version_id, evidence_state);
create index learning_task_overrides_snooze_index
on public.learning_task_overrides (user_id, snoozed_until)
where action = 'snooze';

alter table public.learning_review_states enable row level security;
alter table public.learning_objective_progress enable row level security;
alter table public.learning_preferences enable row level security;
alter table public.learning_task_overrides enable row level security;

revoke all on public.learning_review_states, public.learning_objective_progress,
  public.learning_preferences, public.learning_task_overrides from public;

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
      'public.learning_review_states'::regclass,
      'public.learning_objective_progress'::regclass,
      'public.learning_preferences'::regclass,
      'public.learning_task_overrides'::regclass
    ) and privileges.grantee <> tables.relowner
  loop
    execute format(
      'revoke all on public.learning_review_states, public.learning_objective_progress, public.learning_preferences, public.learning_task_overrides from %I',
      inherited_grantee
    );
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update on public.learning_review_states,
      public.learning_objective_progress, public.learning_preferences,
      public.learning_task_overrides to cediah_runtime;
    grant delete on public.learning_task_overrides to cediah_runtime;

    create policy learning_review_states_runtime on public.learning_review_states
      to cediah_runtime using (true) with check (true);
    create policy learning_objective_progress_runtime on public.learning_objective_progress
      to cediah_runtime using (true) with check (true);
    create policy learning_preferences_runtime on public.learning_preferences
      to cediah_runtime using (true) with check (true);
    create policy learning_task_overrides_runtime on public.learning_task_overrides
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
