-- Editorial topics are optional. An empty topic means the content is attached
-- directly to its selected subject(s) instead of an editorial topic.

alter table public.content_items
  drop constraint if exists content_items_topic_length;

alter table public.content_items
  add constraint content_items_topic_length check (
    char_length(btrim(topic)) <= 120
  );
