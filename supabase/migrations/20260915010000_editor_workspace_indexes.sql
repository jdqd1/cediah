-- Keep the editorial workspace fast as the content corpus grows.
-- Mirrors database/migrations/0018_editor_workspace_indexes.sql.

create index if not exists content_items_updated_at_index
on public.content_items (updated_at desc);

create index if not exists content_items_author_updated_at_index
on public.content_items (author_user_id, updated_at desc);
