-- Dynamic learning content metadata. Object storage is configured separately.

create type public.content_kind as enum (
  'video',
  'guide',
  'quiz',
  'flashcards',
  'topic'
);

create type public.content_asset_kind as enum ('video', 'document', 'image');
create type public.content_asset_status as enum ('pending', 'ready');

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text not null unique,
  title text not null,
  summary text not null,
  topic text not null,
  status public.course_status not null default 'draft',
  content jsonb not null default '{}'::jsonb,
  estimated_minutes integer,
  is_featured boolean not null default false,
  version integer not null default 1,
  author_user_id uuid not null references public.auth_users (id) on delete restrict,
  reviewed_by uuid references public.auth_users (id) on delete set null,
  reviewed_at timestamptz,
  published_by uuid references public.auth_users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_items_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint content_items_title_length check (
    char_length(btrim(title)) between 1 and 200
  ),
  constraint content_items_summary_length check (
    char_length(btrim(summary)) between 1 and 2000
  ),
  constraint content_items_topic_length check (
    char_length(btrim(topic)) between 1 and 120
  ),
  constraint content_items_content_is_object check (
    jsonb_typeof(content) = 'object'
  ),
  constraint content_items_estimated_minutes_positive check (
    estimated_minutes is null or estimated_minutes >= 0
  ),
  constraint content_items_version_positive check (version > 0),
  constraint content_items_review_fields check (
    (reviewed_by is null and reviewed_at is null)
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint content_items_publication_fields check (
    (
      status = 'published'
      and published_at is not null
      and published_by is not null
    )
    or status <> 'published'
  )
);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  owner_user_id uuid not null references public.auth_users (id) on delete restrict,
  kind public.content_asset_kind not null,
  storage_bucket text not null,
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  status public.content_asset_status not null default 'pending',
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  constraint content_assets_bucket_length check (
    char_length(btrim(storage_bucket)) between 2 and 63
  ),
  constraint content_assets_path_length check (
    char_length(btrim(storage_path)) between 1 and 1000
  ),
  constraint content_assets_file_name_length check (
    char_length(btrim(original_file_name)) between 1 and 255
  ),
  constraint content_assets_size_range check (
    size_bytes > 0 and size_bytes <= 500000000
  ),
  constraint content_assets_kind_matches_mime check (
    (kind = 'video' and mime_type in ('video/mp4', 'video/quicktime', 'video/webm'))
    or (kind = 'document' and mime_type = 'application/pdf')
    or (kind = 'image' and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
  ),
  constraint content_assets_finalization_fields check (
    (status = 'ready' and finalized_at is not null)
    or (status = 'pending' and finalized_at is null)
  )
);

create index content_items_author_user_id_index
on public.content_items (author_user_id);
create index content_items_reviewed_by_index
on public.content_items (reviewed_by);
create index content_items_published_by_index
on public.content_items (published_by);
create index content_items_status_published_at_index
on public.content_items (status, published_at desc);
create index content_items_kind_status_index
on public.content_items (kind, status);
create index content_items_topic_status_index
on public.content_items (topic, status);
create index content_assets_content_item_id_index
on public.content_assets (content_item_id);
create index content_assets_owner_user_id_index
on public.content_assets (owner_user_id);

create trigger content_items_set_updated_at
before update on public.content_items
for each row execute function private.set_updated_at();
