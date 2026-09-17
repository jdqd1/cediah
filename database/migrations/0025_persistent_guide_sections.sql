-- Stable section identities decoupled from visible heading text.
-- These rows are intentionally small and bounded by the number of real guide
-- sections, unlike term occurrences which remain compact JSON annotations.

create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  anchor_id text not null,
  node_path text not null,
  label text not null,
  normalized_label text not null,
  context_key text,
  level smallint not null,
  ordinal integer not null,
  content_version integer not null,
  updated_at timestamptz not null default now(),
  constraint guide_sections_anchor_format check (
    anchor_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint guide_sections_anchor_length check (char_length(anchor_id) between 1 and 120),
  constraint guide_sections_path_length check (char_length(node_path) between 1 and 240),
  constraint guide_sections_label_length check (char_length(label) between 1 and 500),
  constraint guide_sections_normalized_label_length check (char_length(normalized_label) between 1 and 500),
  constraint guide_sections_context_length check (context_key is null or char_length(context_key) <= 240),
  constraint guide_sections_level_range check (level between 1 and 3),
  constraint guide_sections_ordinal_nonnegative check (ordinal >= 0),
  constraint guide_sections_content_version_positive check (content_version > 0),
  unique (content_item_id, anchor_id),
  unique (content_item_id, node_path)
);

create index guide_sections_content_version_index
on public.guide_sections (content_item_id, content_version);

create index guide_sections_content_label_index
on public.guide_sections (content_item_id, normalized_label, level);

create index guide_sections_content_context_index
on public.guide_sections (content_item_id, context_key, level)
where context_key is not null;

create trigger guide_sections_set_updated_at
before update on public.guide_sections
for each row execute function private.set_updated_at();
