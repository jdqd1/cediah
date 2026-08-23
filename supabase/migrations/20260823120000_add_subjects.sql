-- Subjects turn the catalog into a multi-discipline learning platform.
-- Content stays reusable: one publication may belong to many subjects.

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  constraint subjects_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint subjects_name_length check (
    char_length(btrim(name)) between 1 and 120
  )
);

create unique index subjects_name_lower_unique
on public.subjects (lower(name));

create table public.content_subjects (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_item_id, subject_id)
);

create index content_subjects_subject_id_index
on public.content_subjects (subject_id, content_item_id);

create index content_subjects_content_item_id_index
on public.content_subjects (content_item_id, subject_id);

alter table public.subjects enable row level security;
alter table public.content_subjects enable row level security;

revoke all on table public.subjects from anon, authenticated;
revoke all on table public.content_subjects from anon, authenticated;

grant select, insert, update, delete on table public.subjects to service_role;
grant select, insert, update, delete on table public.content_subjects to service_role;

insert into public.subjects (name, slug)
values
  ('Anatomía', 'anatomia'),
  ('Biología celular', 'biologia-celular'),
  ('Fisiología', 'fisiologia'),
  ('Histología', 'histologia'),
  ('Bioquímica', 'bioquimica')
on conflict (slug) do nothing;

-- Existing publications were authored for the original anatomy catalog.
-- Keep them discoverable after the migration without duplicating content.
insert into public.content_subjects (content_item_id, subject_id)
select content.id, subject.id
from public.content_items as content
cross join public.subjects as subject
where subject.slug = 'anatomia'
on conflict do nothing;
