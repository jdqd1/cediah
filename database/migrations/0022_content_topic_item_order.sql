-- Persist a manual display order for content items inside each subject/topic pair.
-- The order is editorial metadata: deleting a subject or content item cleans it automatically.

create table public.content_topic_item_order (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  topic_key text not null,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  position integer not null,
  updated_at timestamptz not null default now(),
  primary key (subject_id, topic_key, content_item_id),
  constraint content_topic_item_order_topic_key_length check (
    char_length(btrim(topic_key)) between 1 and 120
  ),
  constraint content_topic_item_order_position_nonnegative check (position >= 0)
);

create unique index content_topic_item_order_position_unique
on public.content_topic_item_order (subject_id, topic_key, position);

create index content_topic_item_order_content_item_index
on public.content_topic_item_order (content_item_id);
