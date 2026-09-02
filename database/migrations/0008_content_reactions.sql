-- One current choice per viewer/video, plus small aggregates for future admin
-- reports. No click history and no personal identifiers are stored here.
create table public.content_reaction_counts (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  like_count bigint not null default 0 check (like_count >= 0),
  dislike_count bigint not null default 0 check (dislike_count >= 0)
);

create table public.content_reactions (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) = 64),
  reaction text not null check (reaction in ('liked', 'disliked')),
  updated_at timestamptz not null default now(),
  primary key (content_item_id, viewer_key)
);

-- Fastify authenticates and derives the content-scoped viewer key. These
-- tables must not be exposed through a hosting provider's public Data API.
alter table public.content_reaction_counts enable row level security;
alter table public.content_reactions enable row level security;
revoke all on public.content_reaction_counts, public.content_reactions from public;

do $$
declare
  inherited_grantee text;
begin
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid in ('public.content_reaction_counts'::regclass, 'public.content_reactions'::regclass)
      and privileges.grantee <> tables.relowner
  loop
    execute format('revoke all on public.content_reaction_counts, public.content_reactions from %I', inherited_grantee);
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update on public.content_reaction_counts to cediah_runtime;
    grant select, insert, update, delete on public.content_reactions to cediah_runtime;
    create policy content_reaction_counts_runtime on public.content_reaction_counts
      to cediah_runtime using (true) with check (true);
    create policy content_reactions_runtime on public.content_reactions
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
