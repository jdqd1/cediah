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

create or replace function public.cediah_content_search_text(
  content_kind public.content_kind,
  content jsonb
)
returns text
language sql
immutable
strict
parallel safe
as $$
  select case content_kind
    when 'video'::public.content_kind then
      coalesce(content ->> 'description', '') || ' ' ||
      coalesce((content -> 'keyPoints')::text, '') || ' ' ||
      coalesce((content -> 'guide')::text, '') || ' ' ||
      coalesce((content -> 'quiz')::text, '') || ' ' ||
      coalesce((content -> 'regions')::text, '')
    when 'guide'::public.content_kind then
      coalesce((content -> 'document')::text, '') || ' ' ||
      coalesce((content -> 'keyPoints')::text, '') || ' ' ||
      coalesce((content -> 'quiz')::text, '') || ' ' ||
      coalesce((content -> 'regions')::text, '') || ' ' ||
      coalesce((content -> 'sections')::text, '')
    else ''
  end;
$$;

create or replace function public.cediah_content_search_vector(
  content_kind public.content_kind,
  content_title text,
  content_topic text,
  content_summary text,
  content jsonb
)
returns tsvector
language sql
immutable
parallel safe
as $$
  select
    setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(coalesce(content_title, ''))
      ),
      'A'
    )
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(
          coalesce(content_topic, '') || ' ' || coalesce(content_summary, '')
        )
      ),
      'B'
    )
    || setweight(
      to_tsvector(
        'simple'::regconfig,
        public.cediah_search_normalize(
          public.cediah_content_search_text(content_kind, coalesce(content, '{}'::jsonb))
        )
      ),
      'C'
    );
$$;

alter table public.content_items
  add column if not exists search_vector tsvector;

update public.content_items
set search_vector = public.cediah_content_search_vector(kind, title, topic, summary, content)
where search_vector is null;

create or replace function public.cediah_refresh_content_search_vector()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := public.cediah_content_search_vector(
    new.kind,
    new.title,
    new.topic,
    new.summary,
    new.content
  );
  return new;
end;
$$;

drop trigger if exists content_items_refresh_search_vector on public.content_items;

create trigger content_items_refresh_search_vector
before insert or update of kind, title, topic, summary, content
on public.content_items
for each row
execute function public.cediah_refresh_content_search_vector();

create index if not exists content_items_published_search_vector_index
  on public.content_items using gin (search_vector)
  where status = 'published'
    and catalog_visibility = 'catalog'
    and kind in ('guide', 'video');
