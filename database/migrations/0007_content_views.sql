-- Aggregated reading counts live outside content_items: a view must not change
-- editorial updated_at/version, duplicate content, or create an event stream.
create table public.content_view_counts (
  content_item_id uuid primary key references public.content_items (id) on delete cascade,
  view_count bigint not null default 0 check (view_count >= 0)
);

create index content_view_counts_rank_index
  on public.content_view_counts (view_count desc, content_item_id);

-- One small receipt per reader/content pair, overwritten after 30 minutes.
-- The server derives an opaque, content-scoped HMAC; no email, IP or user ID
-- is stored here, and keys cannot be correlated across different content.
create table public.content_view_receipts (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  viewer_key text not null check (char_length(viewer_key) = 64),
  last_viewed_at timestamptz not null default now(),
  primary key (content_item_id, viewer_key)
);

-- Fastify is the only access boundary. Do not expose analytics through the
-- hosting provider's Data API, even when it grants new public tables by default.
alter table public.content_view_counts enable row level security;
alter table public.content_view_receipts enable row level security;
revoke all on public.content_view_counts, public.content_view_receipts from public;

do $$
declare
  inherited_grantee text;
begin
  -- Revoke hosting/default grants without depending on vendor-specific roles.
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid in ('public.content_view_counts'::regclass, 'public.content_view_receipts'::regclass)
      and privileges.grantee <> tables.relowner
  loop
    execute format('revoke all on public.content_view_counts, public.content_view_receipts from %I', inherited_grantee);
  end loop;

  -- The production runtime is not a superuser and has no BYPASSRLS.
  -- A fresh portable database may instead run the API as the table owner.
  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update, delete on public.content_view_counts, public.content_view_receipts to cediah_runtime;
    create policy content_view_counts_runtime on public.content_view_counts
      to cediah_runtime using (true) with check (true);
    create policy content_view_receipts_runtime on public.content_view_receipts
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
