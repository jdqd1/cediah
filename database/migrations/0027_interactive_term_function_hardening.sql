-- Pin search_path for interactive-term functions so object resolution cannot be influenced by caller state.

alter function private.normalize_term_key(text)
  set search_path = pg_catalog, public, private;
alter function private.enqueue_guide_term_reindex(uuid, text)
  set search_path = pg_catalog, public, private;
alter function private.enqueue_all_published_guides_for_terms(text)
  set search_path = pg_catalog, public, private;
alter function private.bump_interactive_term_dictionary_revision()
  set search_path = pg_catalog, public, private;
alter function private.queue_published_guide_term_reindex()
  set search_path = pg_catalog, public, private;
