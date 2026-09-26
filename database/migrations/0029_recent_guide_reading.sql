-- Keep each account's recent guide reads without changing editorial timestamps.
create table public.user_recent_guides (
  user_id uuid not null references public.auth_users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, content_item_id)
);

create index user_recent_guides_latest_index
  on public.user_recent_guides (user_id, read_at desc, content_item_id);

alter table public.user_recent_guides enable row level security;
revoke all on public.user_recent_guides from public;

do $$
declare
  inherited_grantee text;
begin
  for inherited_grantee in
    select distinct roles.rolname
    from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid = privileges.grantee
    where tables.oid = 'public.user_recent_guides'::regclass
      and privileges.grantee <> tables.relowner
  loop
    execute format('revoke all on public.user_recent_guides from %I', inherited_grantee);
  end loop;

  if exists (select 1 from pg_roles where rolname = 'cediah_runtime') then
    grant select, insert, update, delete on public.user_recent_guides to cediah_runtime;
    create policy user_recent_guides_runtime on public.user_recent_guides
      to cediah_runtime using (true) with check (true);
  end if;
end;
$$;
