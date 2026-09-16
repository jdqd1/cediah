-- The public catalog uses a partial GIN index, but the editorial workspace also
-- searches drafts, review items, archived content and hidden publications.
-- Keep that search server-side without forcing a full scan as the corpus grows.
create index if not exists content_items_editor_search_vector_index
  on public.content_items using gin (search_vector);
