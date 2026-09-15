-- Add a compact, accent-insensitive full-text index for published guides and videos.
-- The searchable body intentionally excludes video cover images and external URLs so
-- embedded base64 assets never enter the tsvector.

create or replace function public.cediah_search_normalize(value text)
returns text
language sql
immutable
strict
parallel safe
as $$
  select translate(
    lower(value),
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiiooooouuuunc'
  );
$$;

create or replace function public.cediah_content_search_text(content_kind text, content jsonb)
returns text
language sql
immutable
strict
parallel safe
as $$
  select case content_kind
    when 'video' then concat_ws(
      ' ',
      content ->> 'description',
      (content -> 'keyPoints')::text,
      (content -> 'guide')::text,
      (content -> 'quiz')::text,
      (content -> 'regions')::text
    )
    when 'guide' then concat_ws(
      ' ',
      (content -> 'document')::text,
      (content -> 'keyPoints')::text,
      (content -> 'quiz')::text,
      (content -> 'regions')::text,
      (content -> 'sections')::text
    )
    else ''
  end;
$$;

alter table public.content_items
  add column if not exists search_vector tsvector
  generated always as (
    setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(coalesce(title, ''))
      ),
      'A'
    )
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(
          concat_ws(' ', coalesce(topic, ''), coalesce(summary, ''))
        )
      ),
      'B'
    )
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(
          public.cediah_content_search_text(kind::text, content)
        )
      ),
      'C'
    )
  ) stored;

create index if not exists content_items_published_search_vector_index
  on public.content_items using gin (search_vector)
  where status = 'published'
    and catalog_visibility = 'catalog'
    and kind in ('guide', 'video');
