-- Keep draft persistence aligned with the API contract and persist editorial topics independently.

alter table public.content_items
  drop constraint if exists content_items_title_length,
  drop constraint if exists content_items_summary_length,
  drop constraint if exists content_items_topic_length;

alter table public.content_items
  add constraint content_items_title_length check (
    char_length(btrim(title)) <= 200
    and (
      status in ('draft', 'changes_requested')
      or char_length(btrim(title)) >= 1
    )
  ),
  add constraint content_items_summary_length check (
    char_length(btrim(summary)) <= 2000
    and (
      status in ('draft', 'changes_requested')
      or char_length(btrim(summary)) >= 1
    )
  ),
  add constraint content_items_topic_length check (
    char_length(btrim(topic)) <= 120
    and (
      status in ('draft', 'changes_requested')
      or char_length(btrim(topic)) >= 1
    )
  );

create table public.content_topics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint content_topics_name_length check (
    char_length(btrim(name)) between 1 and 120
  )
);

create unique index content_topics_name_lower_unique
on public.content_topics (lower(name));

create table public.content_topic_subjects (
  topic_id uuid not null references public.content_topics (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (topic_id, subject_id)
);

create index content_topic_subjects_subject_id_index
on public.content_topic_subjects (subject_id, topic_id);

create index content_topic_subjects_topic_id_index
on public.content_topic_subjects (topic_id, subject_id);

with extracted_topics as (
  select btrim(content.topic) as name
  from public.content_items as content
  where btrim(content.topic) <> ''

  union

  select btrim(region.value) as name
  from public.content_items as content
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(content.content -> 'regions') = 'array'
        then content.content -> 'regions'
      else '[]'::jsonb
    end
  ) as region(value)
  where btrim(region.value) <> ''
)
insert into public.content_topics (name)
select distinct name
from extracted_topics
on conflict do nothing;

with content_topic_names as (
  select content.id as content_item_id, btrim(content.topic) as name
  from public.content_items as content
  where btrim(content.topic) <> ''

  union

  select content.id as content_item_id, btrim(region.value) as name
  from public.content_items as content
  cross join lateral jsonb_array_elements_text(
    case
      when jsonb_typeof(content.content -> 'regions') = 'array'
        then content.content -> 'regions'
      else '[]'::jsonb
    end
  ) as region(value)
  where btrim(region.value) <> ''
)
insert into public.content_topic_subjects (topic_id, subject_id)
select distinct topic.id, content_subject.subject_id
from content_topic_names as content_topic
join public.content_subjects as content_subject
  on content_subject.content_item_id = content_topic.content_item_id
join public.content_topics as topic
  on lower(topic.name) = lower(content_topic.name)
on conflict do nothing;
