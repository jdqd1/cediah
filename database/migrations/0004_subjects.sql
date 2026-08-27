-- Multi-discipline catalog taxonomy.

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

insert into public.subjects (name, slug)
values
  ('Anatomía', 'anatomia'),
  ('Biología celular', 'biologia-celular'),
  ('Fisiología', 'fisiologia'),
  ('Histología', 'histologia'),
  ('Bioquímica', 'bioquimica')
on conflict (slug) do nothing;

insert into public.content_subjects (content_item_id, subject_id)
select content.id, subject.id
from public.content_items as content
cross join public.subjects as subject
where subject.slug = 'anatomia'
on conflict do nothing;
