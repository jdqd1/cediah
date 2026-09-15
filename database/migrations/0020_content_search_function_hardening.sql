-- Pin search paths for content-search helpers so role-level settings cannot
-- change which built-ins or schema objects are resolved at execution time.

alter function public.cediah_search_normalize(text)
  set search_path = pg_catalog, public;

alter function public.cediah_content_search_text(public.content_kind, jsonb)
  set search_path = pg_catalog, public;

alter function public.cediah_content_search_vector(public.content_kind, text, text, text, jsonb)
  set search_path = pg_catalog, public;

alter function public.cediah_refresh_content_search_vector()
  set search_path = pg_catalog, public;
