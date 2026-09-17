-- Secure interactive-term tables from the Supabase Data API while allowing the dedicated application runtime role.

alter table public.interactive_terms enable row level security;
alter table public.interactive_term_aliases enable row level security;
alter table public.guide_sections enable row level security;
alter table public.interactive_term_links enable row level security;
alter table public.interactive_term_dictionary_state enable row level security;
alter table public.guide_term_manifests enable row level security;
alter table public.guide_term_usage enable row level security;
alter table public.guide_term_reindex_queue enable row level security;

revoke all on table public.interactive_terms from anon, authenticated;
revoke all on table public.interactive_term_aliases from anon, authenticated;
revoke all on table public.guide_sections from anon, authenticated;
revoke all on table public.interactive_term_links from anon, authenticated;
revoke all on table public.interactive_term_dictionary_state from anon, authenticated;
revoke all on table public.guide_term_manifests from anon, authenticated;
revoke all on table public.guide_term_usage from anon, authenticated;
revoke all on table public.guide_term_reindex_queue from anon, authenticated;

grant select, insert, update, delete on table public.interactive_terms to cediah_runtime;
grant select, insert, update, delete on table public.interactive_term_aliases to cediah_runtime;
grant select, insert, update, delete on table public.guide_sections to cediah_runtime;
grant select, insert, update, delete on table public.interactive_term_links to cediah_runtime;
grant select, insert, update, delete on table public.interactive_term_dictionary_state to cediah_runtime;
grant select, insert, update, delete on table public.guide_term_manifests to cediah_runtime;
grant select, insert, update, delete on table public.guide_term_usage to cediah_runtime;
grant select, insert, update, delete on table public.guide_term_reindex_queue to cediah_runtime;

grant select, insert, update, delete on table public.interactive_terms to service_role;
grant select, insert, update, delete on table public.interactive_term_aliases to service_role;
grant select, insert, update, delete on table public.guide_sections to service_role;
grant select, insert, update, delete on table public.interactive_term_links to service_role;
grant select, insert, update, delete on table public.interactive_term_dictionary_state to service_role;
grant select, insert, update, delete on table public.guide_term_manifests to service_role;
grant select, insert, update, delete on table public.guide_term_usage to service_role;
grant select, insert, update, delete on table public.guide_term_reindex_queue to service_role;

create policy cediah_runtime_all on public.interactive_terms for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.interactive_term_aliases for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.guide_sections for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.interactive_term_links for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.interactive_term_dictionary_state for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.guide_term_manifests for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.guide_term_usage for all to cediah_runtime using (true) with check (true);
create policy cediah_runtime_all on public.guide_term_reindex_queue for all to cediah_runtime using (true) with check (true);

create policy cediah_deny_data_api on public.interactive_terms for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.interactive_term_aliases for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.guide_sections for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.interactive_term_links for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.interactive_term_dictionary_state for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.guide_term_manifests for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.guide_term_usage for all to anon, authenticated using (false) with check (false);
create policy cediah_deny_data_api on public.guide_term_reindex_queue for all to anon, authenticated using (false) with check (false);
