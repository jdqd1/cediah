-- Avoid corpus-wide reindexing when only presentation metadata changes.
-- Definitions, categories and destination links are read live by the manifest API;
-- only fields that can change matching semantics invalidate guide occurrences.

drop trigger if exists interactive_terms_dictionary_revision
on public.interactive_terms;

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
  return null;
end;
$$;

create trigger interactive_terms_dictionary_insert_delete
  after insert or delete on public.interactive_terms
  for each statement execute function private.bump_interactive_term_dictionary_revision();

create trigger interactive_terms_dictionary_match_update
  after update of name, is_active, auto_match, priority, occurrence_policy
  on public.interactive_terms
  for each statement execute function private.bump_interactive_term_dictionary_revision();
