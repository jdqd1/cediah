-- Idempotent learning points and durable milestones.
-- Rewards are derived from accepted learning events and never from client claims.

create table public.learning_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.auth_users (id) on delete cascade,
  award_key text not null,
  reward_kind text not null check (reward_kind in (
    'activity_understand',
    'activity_recall',
    'activity_check',
    'review_applied',
    'unit_completed',
    'route_completed',
    'milestone_first_activity',
    'milestone_first_unit',
    'milestone_first_review'
  )),
  xp integer not null check (xp >= 0),
  event_id uuid not null references public.learning_events (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  unique (user_id, award_key),
  constraint learning_rewards_key_length check (
    char_length(btrim(award_key)) between 1 and 300
  )
);

create index learning_rewards_user_date_index
on public.learning_rewards (user_id, local_date desc, created_at desc);

create index learning_rewards_event_index
on public.learning_rewards (event_id);

alter table public.learning_rewards enable row level security;
revoke all on public.learning_rewards from public;

do $$
declare
  inherited_grantee text;
begin
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid = 'public.learning_rewards'::regclass
      and privileges.grantee <> tables.relowner
  loop
    execute format('revoke all on public.learning_rewards from %I', inherited_grantee);
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert on public.learning_rewards to cediah_runtime;

    create policy learning_rewards_runtime on public.learning_rewards
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
