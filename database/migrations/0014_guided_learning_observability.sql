-- Durable retry counters for guided-learning idempotency receipts. Business
-- mutations remain idempotent; this metadata exists only for operational
-- measurement and follows the receipt's existing 30-day retention window.

alter table public.learning_mutation_receipts
  add column replay_count integer not null default 0,
  add column last_replayed_at timestamptz,
  add constraint learning_mutation_receipts_replay_count_check
    check (replay_count >= 0),
  add constraint learning_mutation_receipts_replay_timestamp_check
    check (
      (replay_count = 0 and last_replayed_at is null)
      or (replay_count > 0 and last_replayed_at is not null)
    );

create index learning_mutation_receipts_replay_index
on public.learning_mutation_receipts (last_replayed_at desc)
where replay_count > 0;
