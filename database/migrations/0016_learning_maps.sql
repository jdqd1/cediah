create table public.learning_maps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.auth_users(id) on delete cascade,
  row_version integer not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.learning_map_nodes (
  id uuid primary key default gen_random_uuid(), map_id uuid not null references public.learning_maps(id) on delete cascade,
  title text not null check (title = btrim(title) and char_length(title) between 1 and 80),
  icon_key text not null check (icon_key in ('anatomy','molecule','heart','tissue','pill','stethoscope','head','arm','chest','abdomen','pelvis','leg','brain','skin','lungs','vessel','diaphragm','kidney','endocrine','droplet','folder')),
  origin_topic_id uuid references public.content_items(id), sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,map_id)
);
create table public.learning_map_entries (
  id uuid primary key default gen_random_uuid(), map_id uuid not null references public.learning_maps(id) on delete cascade,
  node_id uuid not null, kind text not null check (kind in ('block','lesson')),
  path_id uuid not null references public.learning_paths(id), unit_stable_key text,
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(node_id,map_id) references public.learning_map_nodes(id,map_id) on delete cascade,
  check ((kind = 'block' and unit_stable_key is null) or (kind = 'lesson' and unit_stable_key is not null and char_length(unit_stable_key) between 1 and 120 and unit_stable_key ~ '^[a-z0-9]+([-_][a-z0-9]+)*$'))
);
create unique index learning_map_entries_blocks_unique on public.learning_map_entries(node_id,path_id) where kind='block';
create unique index learning_map_entries_lessons_unique on public.learning_map_entries(node_id,path_id,unit_stable_key) where kind='lesson';
create index learning_map_nodes_map_index on public.learning_map_nodes(map_id,sort_order);
create index learning_map_nodes_topic_index on public.learning_map_nodes(origin_topic_id);
create index learning_map_entries_map_index on public.learning_map_entries(map_id);
create index learning_map_entries_node_map_index on public.learning_map_entries(node_id,map_id);
create index learning_map_entries_path_index on public.learning_map_entries(path_id);
create table public.learning_map_layouts (
  map_id uuid not null references public.learning_maps(id) on delete cascade,
  level_key text not null check (level_key ~ '^(root|(node|block):[0-9a-f-]{36})$'),
  row_version integer not null default 1 check (row_version >= 1), schema_version integer not null default 1 check (schema_version = 1),
  positions_json jsonb not null default '{}'::jsonb check (jsonb_typeof(positions_json) = 'object'),
  updated_at timestamptz not null default now(), primary key(map_id,level_key)
);
alter table public.learning_maps enable row level security;
alter table public.learning_map_nodes enable row level security;
alter table public.learning_map_entries enable row level security;
alter table public.learning_map_layouts enable row level security;
revoke all on public.learning_maps, public.learning_map_nodes, public.learning_map_entries, public.learning_map_layouts from public;
do $$
declare inherited_grantee text;
begin
  for inherited_grantee in
    select distinct roles.rolname from pg_class as tables
    cross join lateral aclexplode(tables.relacl) as privileges
    join pg_roles as roles on roles.oid=privileges.grantee
    where tables.oid in ('public.learning_maps'::regclass,'public.learning_map_nodes'::regclass,'public.learning_map_entries'::regclass,'public.learning_map_layouts'::regclass)
      and privileges.grantee <> tables.relowner
  loop
    execute format('revoke all on public.learning_maps, public.learning_map_nodes, public.learning_map_entries, public.learning_map_layouts from %I',inherited_grantee);
  end loop;
  if exists(select 1 from pg_roles where rolname='cediah_runtime') then
    grant select,insert,update,delete on public.learning_maps,public.learning_map_nodes,public.learning_map_entries,public.learning_map_layouts to cediah_runtime;
    create policy learning_maps_runtime on public.learning_maps to cediah_runtime using(true) with check(true);
    create policy learning_map_nodes_runtime on public.learning_map_nodes to cediah_runtime using(true) with check(true);
    create policy learning_map_entries_runtime on public.learning_map_entries to cediah_runtime using(true) with check(true);
    create policy learning_map_layouts_runtime on public.learning_map_layouts to cediah_runtime using(true) with check(true);
  end if;
end;
$$;
