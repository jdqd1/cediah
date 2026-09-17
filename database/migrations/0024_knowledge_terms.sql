-- Global interactive knowledge terms for guide documents.
-- Canonical term metadata is stored once. Guides only materialize compact
-- occurrence references and stable section anchors.

create table public.knowledge_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_definition text not null,
  category text,
  active boolean not null default true,
  auto_link boolean not null default true,
  priority integer not null default 0,
  frequency text not null default 'first_section',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_terms_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint knowledge_terms_name_length check (
    char_length(btrim(name)) between 1 and 200
  ),
  constraint knowledge_terms_definition_length check (
    char_length(btrim(short_definition)) between 1 and 1200
  ),
  constraint knowledge_terms_category_length check (
    category is null or char_length(btrim(category)) between 1 and 120
  ),
  constraint knowledge_terms_priority_range check (priority between -1000 and 1000),
  constraint knowledge_terms_frequency_valid check (
    frequency in ('first_section', 'first_guide', 'all')
  )
);

create or replace function public.cediah_term_normalize(value text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select regexp_replace(
    btrim(public.cediah_search_normalize(value)),
    '\s+',
    ' ',
    'g'
  );
$$;

create table public.knowledge_term_aliases (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.knowledge_terms (id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (public.cediah_term_normalize(alias)) stored,
  is_canonical boolean not null default false,
  auto_link boolean not null default true,
  case_sensitive boolean not null default false,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  constraint knowledge_term_aliases_alias_length check (
    char_length(btrim(alias)) between 2 and 200
  ),
  constraint knowledge_term_aliases_priority_range check (priority between -1000 and 1000),
  constraint knowledge_term_aliases_unique_per_term unique (term_id, normalized_alias)
);

create unique index knowledge_term_aliases_one_canonical_index
on public.knowledge_term_aliases (term_id)
where is_canonical;

create index knowledge_term_aliases_normalized_index
on public.knowledge_term_aliases (normalized_alias);

create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  node_path text not null,
  anchor text not null,
  heading text not null,
  ordinal integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_sections_node_path_length check (
    char_length(node_path) between 1 and 500
  ),
  constraint guide_sections_anchor_format check (
    anchor ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint guide_sections_heading_length check (
    char_length(btrim(heading)) between 1 and 500
  ),
  constraint guide_sections_ordinal_nonnegative check (ordinal >= 0),
  constraint guide_sections_content_node_unique unique (content_item_id, node_path),
  constraint guide_sections_content_anchor_unique unique (content_item_id, anchor),
  constraint guide_sections_id_content_unique unique (id, content_item_id)
);

create index guide_sections_content_ordinal_index
on public.guide_sections (content_item_id, ordinal);

create table public.knowledge_term_targets (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.knowledge_terms (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_id uuid,
  label text,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  constraint knowledge_term_targets_priority_range check (priority between -1000 and 1000),
  constraint knowledge_term_targets_label_length check (
    label is null or char_length(btrim(label)) between 1 and 200
  ),
  constraint knowledge_term_targets_section_content_fk
    foreign key (section_id, content_item_id)
    references public.guide_sections (id, content_item_id)
    on delete cascade
);

create unique index knowledge_term_targets_section_unique_index
on public.knowledge_term_targets (term_id, content_item_id, section_id)
where section_id is not null;

create unique index knowledge_term_targets_guide_unique_index
on public.knowledge_term_targets (term_id, content_item_id)
where section_id is null;

create index knowledge_term_targets_term_priority_index
on public.knowledge_term_targets (term_id, priority desc);

create table public.guide_term_occurrences (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  term_id uuid not null references public.knowledge_terms (id) on delete cascade,
  alias_id uuid not null references public.knowledge_term_aliases (id) on delete cascade,
  section_id uuid references public.guide_sections (id) on delete set null,
  node_path text not null,
  start_offset integer not null,
  end_offset integer not null,
  occurrence_index integer not null,
  created_at timestamptz not null default now(),
  primary key (content_item_id, node_path, start_offset, end_offset),
  constraint guide_term_occurrences_offsets_valid check (
    start_offset >= 0 and end_offset > start_offset
  ),
  constraint guide_term_occurrences_index_nonnegative check (occurrence_index >= 0)
);

create index guide_term_occurrences_content_index
on public.guide_term_occurrences (content_item_id, occurrence_index);
create index guide_term_occurrences_term_index
on public.guide_term_occurrences (term_id, content_item_id);

create table public.knowledge_reindex_queue (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  reason text not null default 'content_changed',
  requested_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text,
  constraint knowledge_reindex_queue_attempts_nonnegative check (attempts >= 0)
);

create index knowledge_reindex_queue_requested_index
on public.knowledge_reindex_queue (requested_at asc);

create trigger knowledge_terms_set_updated_at
before update on public.knowledge_terms
for each row execute function private.set_updated_at();

create trigger guide_sections_set_updated_at
before update on public.guide_sections
for each row execute function private.set_updated_at();

create or replace function public.cediah_enqueue_guide_knowledge(
  target_content_id uuid,
  queue_reason text
)
returns void
language sql
as $$
  insert into public.knowledge_reindex_queue (content_item_id, reason, requested_at, attempts, last_error)
  select item.id, queue_reason, now(), 0, null
  from public.content_items as item
  where item.id = target_content_id
    and item.kind = 'guide'
    and item.status = 'published'
  on conflict (content_item_id) do update
  set reason = excluded.reason,
      requested_at = excluded.requested_at,
      attempts = 0,
      last_error = null;
$$;

create or replace function public.cediah_enqueue_guides_for_alias(
  alias_value text,
  queue_reason text
)
returns void
language plpgsql
as $$
declare
  normalized text;
begin
  normalized := public.cediah_term_normalize(alias_value);
  if normalized = '' then
    return;
  end if;

  insert into public.knowledge_reindex_queue (content_item_id, reason, requested_at, attempts, last_error)
  select item.id, queue_reason, now(), 0, null
  from public.content_items as item
  where item.kind = 'guide'
    and item.status = 'published'
    and item.catalog_visibility = 'catalog'
    and item.search_vector @@ websearch_to_tsquery('simple'::regconfig, normalized)
  on conflict (content_item_id) do update
  set reason = excluded.reason,
      requested_at = excluded.requested_at,
      attempts = 0,
      last_error = null;
end;
$$;

create or replace function public.cediah_queue_content_knowledge_change()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'guide' and new.status = 'published' then
    perform public.cediah_enqueue_guide_knowledge(new.id, 'content_changed');
  elsif tg_op = 'UPDATE'
    and old.status = 'published'
    and (new.status <> 'published' or new.kind <> 'guide')
  then
    delete from public.knowledge_reindex_queue where content_item_id = new.id;
    delete from public.guide_term_occurrences where content_item_id = new.id;
    -- Keep guide_sections: their persistent IDs/anchors survive temporary
    -- archival and are reconciled if the guide is published again.
  end if;
  return new;
end;
$$;

create trigger content_items_queue_knowledge_change
after insert or update of content, status, kind
on public.content_items
for each row execute function public.cediah_queue_content_knowledge_change();

create or replace function public.cediah_queue_alias_knowledge_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.cediah_enqueue_guides_for_alias(old.alias, 'alias_changed');
    insert into public.knowledge_reindex_queue (content_item_id, reason, requested_at, attempts, last_error)
    select distinct occurrence.content_item_id, 'alias_changed', now(), 0, null
    from public.guide_term_occurrences as occurrence
    where occurrence.alias_id = old.id
    on conflict (content_item_id) do update
    set reason = excluded.reason,
        requested_at = excluded.requested_at,
        attempts = 0,
        last_error = null;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.cediah_enqueue_guides_for_alias(new.alias, 'alias_changed');
  end if;
  return coalesce(new, old);
end;
$$;

create trigger knowledge_term_aliases_queue_change
after insert or update or delete
on public.knowledge_term_aliases
for each row execute function public.cediah_queue_alias_knowledge_change();

create or replace function public.cediah_queue_term_matching_change()
returns trigger
language plpgsql
as $$
begin
  if (
    new.active is distinct from old.active
    or new.auto_link is distinct from old.auto_link
    or new.priority is distinct from old.priority
    or new.frequency is distinct from old.frequency
  ) then
    insert into public.knowledge_reindex_queue (content_item_id, reason, requested_at, attempts, last_error)
    select distinct occurrence.content_item_id, 'term_matching_changed', now(), 0, null
    from public.guide_term_occurrences as occurrence
    where occurrence.term_id = new.id
    on conflict (content_item_id) do update
    set reason = excluded.reason,
        requested_at = excluded.requested_at,
        attempts = 0,
        last_error = null;

    perform public.cediah_enqueue_guides_for_alias(alias.alias, 'term_matching_changed')
    from public.knowledge_term_aliases as alias
    where alias.term_id = new.id;
  end if;
  return new;
end;
$$;

create trigger knowledge_terms_queue_matching_change
after update on public.knowledge_terms
for each row execute function public.cediah_queue_term_matching_change();

-- Existing publications are indexed lazily by the worker after deployment.
insert into public.knowledge_reindex_queue (content_item_id, reason)
select id, 'migration_backfill'
from public.content_items
where kind = 'guide'
  and status = 'published'
on conflict (content_item_id) do nothing;
