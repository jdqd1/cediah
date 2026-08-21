alter table public.content_items
  drop constraint content_items_title_length,
  drop constraint content_items_summary_length,
  drop constraint content_items_topic_length,
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

comment on constraint content_items_title_length on public.content_items is
  'Allows an empty title only while authoring a draft or requested revision.';

comment on constraint content_items_summary_length on public.content_items is
  'Allows an empty summary only while authoring a draft or requested revision.';

comment on constraint content_items_topic_length on public.content_items is
  'Allows an empty topic only while authoring a draft or requested revision.';
