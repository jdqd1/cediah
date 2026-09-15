-- Keep the editorial workspace fast as the content corpus grows.
-- Administrators order the full workspace by updated_at; contributors use the
-- same order after filtering by author_user_id.

create index if not exists content_items_updated_at_index
on public.content_items (updated_at desc);

create index if not exists content_items_author_updated_at_index
on public.content_items (author_user_id, updated_at desc);
