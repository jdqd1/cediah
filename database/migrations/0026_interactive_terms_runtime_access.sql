-- Keep interactive-term storage private from inherited/browser database roles while
-- allowing the dedicated application runtime role when the deployment defines it.

alter table public.interactive_terms enable row level security;
alter table public.interactive_term_aliases enable row level security;
alter table public.guide_sections enable row level security;
alter table public.interactive_term_links enable row level security;
alter table public.interactive_term_dictionary_state enable row level security;
alter table public.guide_term_manifests enable row level security;
alter table public.guide_term_usage enable row level security;
alter table public.guide_term_reindex_queue enable row level security;

revoke all on public.interactive_terms,
  public.interactive_term_aliases,
  public.guide_sections,
  public.interactive_term_links,
  public.interactive_term_dictionary_state,
  public.guide_term_manifests,
  public.guide_term_usage,
  public.guide_term_reindex_queue
from public;

do $$
declare
  inherited_grantee text;
begin
  -- Revoke provider/default grants without naming vendor-specific roles.
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid in (
      'public.interactive_terms'::regclass,
      'public.interactive_term_aliases'::regclass,
      'public.guide_sections'::regclass,
      'public.interactive_term_links'::regclass,
      'public.interactive_term_dictionary_state'::regclass,
      'public.guide_term_manifests'::regclass,
      'public.guide_term_usage'::regclass,
      'public.guide_term_reindex_queue'::regclass
    )
      and privileges.grantee <> tables.relowner
  loop
    execute format(
      'revoke all on public.interactive_terms, public.interactive_term_aliases, public.guide_sections, public.interactive_term_links, public.interactive_term_dictionary_state, public.guide_term_manifests, public.guide_term_usage, public.guide_term_reindex_queue from %I',
      inherited_grantee
    );
  end loop;

  -- A portable installation may run as the table owner. Production instead uses
  -- a dedicated least-privilege runtime role when cediah_runtime is present.
  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update, delete on public.interactive_terms,
      public.interactive_term_aliases,
      public.guide_sections,
      public.interactive_term_links,
      public.interactive_term_dictionary_state,
      public.guide_term_manifests,
      public.guide_term_usage,
      public.guide_term_reindex_queue
    to cediah_runtime;

    create policy cediah_runtime_all on public.interactive_terms
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.interactive_term_aliases
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.guide_sections
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.interactive_term_links
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.interactive_term_dictionary_state
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.guide_term_manifests
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.guide_term_usage
      to cediah_runtime using (true) with check (true);
    create policy cediah_runtime_all on public.guide_term_reindex_queue
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
