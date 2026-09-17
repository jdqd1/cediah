-- Global interactive-term dictionary and precomputed guide manifests.
-- Terms remain single-source-of-truth records; guides only store compact occurrence metadata.

create type public.term_occurrence_policy as enum (
  'first_per_section',
  'first_per_guide',
  'all'
);

create or replace function private.normalize_term_key(value text)
returns text
language sql
immutable
parallel safe
as $$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áéíóúüñàèìòùâêîôûäëïöü',
        'aeiouunaeiouaeiouaeiou'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

create table public.interactive_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  normalized_name text generated always as (private.normalize_term_key(name)) stored,
  short_definition text not null,
  category text,
  is_active boolean not null default true,
  auto_match boolean not null default true,
  priority integer not null default 0,
  occurrence_policy public.term_occurrence_policy not null default 'first_per_section',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interactive_terms_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint interactive_terms_name_length check (
    char_length(btrim(name)) between 2 and 160
  ),
  constraint interactive_terms_definition_length check (
    char_length(btrim(short_definition)) between 1 and 700
  ),
  constraint interactive_terms_category_length check (
    category is null or char_length(btrim(category)) between 1 and 120
  ),
  constraint interactive_terms_normalized_name_present check (
    char_length(normalized_name) >= 2
  )
);

create unique index interactive_terms_normalized_name_index
on public.interactive_terms (normalized_name);

create table public.interactive_term_aliases (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.interactive_terms (id) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (private.normalize_term_key(alias)) stored,
  auto_match boolean not null default true,
  created_at timestamptz not null default now(),
  constraint interactive_term_aliases_alias_length check (
    char_length(btrim(alias)) between 2 and 160
  ),
  constraint interactive_term_aliases_normalized_present check (
    char_length(normalized_alias) >= 2
  ),
  unique (term_id, normalized_alias)
);

-- An automatically matched spelling may point to only one term. Ambiguous or
-- overly generic aliases can still be stored with auto_match=false.
create unique index interactive_term_aliases_auto_match_key_index
on public.interactive_term_aliases (normalized_alias)
where auto_match = true;

create table public.guide_sections (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  anchor text not null,
  heading text not null,
  heading_key text not null,
  node_path text not null,
  ordinal integer not null,
  level smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_sections_anchor_format check (
    anchor ~ '^[a-z0-9]+(?:-[a-z0-9]+)*(?:--[a-f0-9]{8})?$'
  ),
  constraint guide_sections_heading_length check (
    char_length(btrim(heading)) between 1 and 300
  ),
  constraint guide_sections_ordinal_nonnegative check (ordinal >= 0),
  constraint guide_sections_level_range check (level between 1 and 6),
  unique (content_item_id, anchor),
  unique (content_item_id, node_path),
  unique (id, content_item_id)
);

create index guide_sections_heading_key_index
on public.guide_sections (content_item_id, heading_key);

create table public.interactive_term_links (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.interactive_terms (id) on delete cascade,
  guide_id uuid not null references public.content_items (id) on delete cascade,
  section_id uuid,
  priority integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interactive_term_links_section_guide_fk
    foreign key (section_id, guide_id)
    references public.guide_sections (id, content_item_id)
    on delete set null (section_id),
  unique (term_id, guide_id, section_id)
);

create unique index interactive_term_links_primary_index
on public.interactive_term_links (term_id)
where is_primary = true;
create index interactive_term_links_term_priority_index
on public.interactive_term_links (term_id, is_primary desc, priority desc);

create table public.interactive_term_dictionary_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.interactive_term_dictionary_state (singleton) values (true);

create table public.guide_term_manifests (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  content_version integer not null,
  dictionary_revision bigint not null,
  occurrences jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint guide_term_manifests_occurrences_array check (
    jsonb_typeof(occurrences) = 'array'
  ),
  constraint guide_term_manifests_content_version_positive check (content_version > 0),
  constraint guide_term_manifests_dictionary_revision_positive check (dictionary_revision > 0)
);

create table public.guide_term_usage (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  term_id uuid not null references public.interactive_terms (id) on delete cascade,
  occurrence_count integer not null,
  primary key (content_item_id, term_id),
  constraint guide_term_usage_occurrence_count_positive check (occurrence_count > 0)
);
create index guide_term_usage_term_index
on public.guide_term_usage (term_id, content_item_id);

create table public.guide_term_reindex_queue (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  requested_at timestamptz not null default now(),
  reason text not null default 'content_changed',
  attempt_count integer not null default 0,
  last_error text,
  constraint guide_term_reindex_queue_reason_length check (
    char_length(reason) between 1 and 120
  ),
  constraint guide_term_reindex_queue_attempt_nonnegative check (attempt_count >= 0)
);
create index guide_term_reindex_queue_requested_index
on public.guide_term_reindex_queue (requested_at asc);

create trigger interactive_terms_set_updated_at
before update on public.interactive_terms
for each row execute function private.set_updated_at();
create trigger guide_sections_set_updated_at
before update on public.guide_sections
for each row execute function private.set_updated_at();
create trigger interactive_term_links_set_updated_at
before update on public.interactive_term_links
for each row execute function private.set_updated_at();

create or replace function private.enqueue_guide_term_reindex(
  target_content_id uuid,
  enqueue_reason text
)
returns void
language sql
as $$
  insert into public.guide_term_reindex_queue (content_item_id, requested_at, reason, attempt_count, last_error)
  select content_items.id, now(), left(coalesce(enqueue_reason, 'content_changed'), 120), 0, null
  from public.content_items
  where content_items.id = target_content_id
    and content_items.kind = 'guide'
    and content_items.status = 'published'
  on conflict (content_item_id) do update
  set requested_at = excluded.requested_at,
      reason = excluded.reason,
      attempt_count = 0,
      last_error = null;
$$;

create or replace function private.enqueue_all_published_guides_for_terms(enqueue_reason text)
returns void
language sql
as $$
  insert into public.guide_term_reindex_queue (content_item_id, requested_at, reason, attempt_count, last_error)
  select id, now(), left(coalesce(enqueue_reason, 'dictionary_changed'), 120), 0, null
  from public.content_items
  where kind = 'guide' and status = 'published'
  on conflict (content_item_id) do update
  set requested_at = excluded.requested_at,
      reason = excluded.reason,
      attempt_count = 0,
      last_error = null;
$$;

create or replace function private.bump_interactive_term_dictionary_revision()
returns trigger
language plpgsql
as $$
begin
  update public.interactive_term_dictionary_state
  set revision = revision + 1,
      updated_at = now()
  where singleton = true;

  perform private.enqueue_all_published_guides_for_terms('dictionary_changed');
  return coalesce(new, old);
end;
$$;

create trigger interactive_terms_dictionary_revision
  after insert or update or delete on public.interactive_terms
  for each statement execute function private.bump_interactive_term_dictionary_revision();
create trigger interactive_term_aliases_dictionary_revision
  after insert or update or delete on public.interactive_term_aliases
  for each statement execute function private.bump_interactive_term_dictionary_revision();

create or replace function private.queue_published_guide_term_reindex()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'guide' and new.status = 'published' and (
    tg_op = 'INSERT'
    or old.status is distinct from new.status
    or old.content is distinct from new.content
  ) then
    perform private.enqueue_guide_term_reindex(new.id, 'guide_published_or_changed');
  end if;
  return new;
end;
$$;

create trigger content_items_queue_interactive_term_reindex
  after insert or update of status, content on public.content_items
  for each row execute function private.queue_published_guide_term_reindex();

-- Existing published guides are indexed asynchronously after deployment.
select private.enqueue_all_published_guides_for_terms('migration_backfill');
