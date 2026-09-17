-- Global interactive knowledge terms.
-- Definitions live once; guide matches are stored as one compact annotation blob per content item.

create type public.knowledge_term_frequency as enum (
  'first_document',
  'first_section',
  'all'
);

create table public.knowledge_term_dictionary (
  singleton boolean primary key default true check (singleton),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.knowledge_term_dictionary (singleton, version)
values (true, 1)
on conflict (singleton) do nothing;

create table public.knowledge_terms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_definition text not null,
  category text,
  is_active boolean not null default true,
  auto_link boolean not null default true,
  frequency public.knowledge_term_frequency not null default 'first_section',
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_terms_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint knowledge_terms_name_length check (
    char_length(btrim(name)) between 1 and 160
  ),
  constraint knowledge_terms_definition_length check (
    char_length(btrim(short_definition)) between 1 and 1000
  ),
  constraint knowledge_terms_category_length check (
    category is null or char_length(btrim(category)) between 1 and 80
  )
);

create table public.knowledge_term_aliases (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.knowledge_terms (id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  auto_link boolean not null default true,
  case_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  constraint knowledge_term_aliases_alias_length check (
    char_length(btrim(alias)) between 2 and 160
  ),
  constraint knowledge_term_aliases_normalized_length check (
    char_length(btrim(normalized_alias)) between 2 and 160
  ),
  unique (normalized_alias, case_sensitive)
);

create table public.knowledge_term_links (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.knowledge_terms (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_anchor text,
  priority smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint knowledge_term_links_anchor_length check (
    section_anchor is null or char_length(btrim(section_anchor)) between 1 and 160
  ),
  unique (term_id, content_item_id, section_anchor)
);

create table public.content_term_annotations (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  content_version integer not null,
  dictionary_version bigint not null,
  annotations jsonb not null default '[]'::jsonb,
  term_ids uuid[] not null default '{}'::uuid[],
  compiled_at timestamptz not null default now(),
  constraint content_term_annotations_annotations_array check (
    jsonb_typeof(annotations) = 'array'
  ),
  constraint content_term_annotations_content_version_positive check (
    content_version > 0
  ),
  constraint content_term_annotations_dictionary_version_positive check (
    dictionary_version > 0
  )
);

create index knowledge_term_aliases_term_id_index
on public.knowledge_term_aliases (term_id);

create index knowledge_term_aliases_normalized_index
on public.knowledge_term_aliases (normalized_alias)
where auto_link = true;

create index knowledge_terms_active_auto_link_index
on public.knowledge_terms (is_active, auto_link)
where is_active = true;

create index knowledge_term_links_term_priority_index
on public.knowledge_term_links (term_id, priority desc);

create index knowledge_term_links_content_item_id_index
on public.knowledge_term_links (content_item_id);

create index content_term_annotations_term_ids_gin_index
on public.content_term_annotations using gin (term_ids);

create trigger knowledge_terms_set_updated_at
before update on public.knowledge_terms
for each row execute function private.set_updated_at();

create or replace function private.bump_knowledge_term_dictionary_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.knowledge_term_dictionary
  set version = version + 1,
      updated_at = now()
  where singleton = true;
  return coalesce(new, old);
end;
$$;

create trigger knowledge_terms_bump_dictionary_version
after insert or update or delete on public.knowledge_terms
for each statement execute function private.bump_knowledge_term_dictionary_version();

create trigger knowledge_term_aliases_bump_dictionary_version
after insert or update or delete on public.knowledge_term_aliases
for each statement execute function private.bump_knowledge_term_dictionary_version();

create trigger knowledge_term_links_bump_dictionary_version
after insert or update or delete on public.knowledge_term_links
for each statement execute function private.bump_knowledge_term_dictionary_version();
