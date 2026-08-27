-- Provider-neutral authentication schema for Better Auth 1.7.x.
-- The API is the only database client; browser roles receive no SQL access.

create schema if not exists public;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.auth_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_users_name_length check (char_length(btrim(name)) between 1 and 200),
  constraint auth_users_email_length check (char_length(btrim(email)) between 3 and 320)
);

create unique index auth_users_email_lower_unique
on public.auth_users (lower(email));

create table public.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id uuid not null references public.auth_users (id) on delete cascade
);

create index auth_sessions_user_id_index on public.auth_sessions (user_id);
create index auth_sessions_expires_at_index on public.auth_sessions (expires_at);

create table public.auth_accounts (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  account_id text not null,
  provider_id text not null,
  user_id uuid not null references public.auth_users (id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (issuer, account_id)
);

create index auth_accounts_user_id_index on public.auth_accounts (user_id);
create index auth_accounts_provider_account_index
on public.auth_accounts (provider_id, account_id);

create table public.auth_verifications (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auth_verifications_identifier_index
on public.auth_verifications (identifier);
create index auth_verifications_expires_at_index
on public.auth_verifications (expires_at);

create table public.auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

create trigger auth_users_set_updated_at
before update on public.auth_users
for each row execute function private.set_updated_at();

create trigger auth_sessions_set_updated_at
before update on public.auth_sessions
for each row execute function private.set_updated_at();

create trigger auth_accounts_set_updated_at
before update on public.auth_accounts
for each row execute function private.set_updated_at();

create trigger auth_verifications_set_updated_at
before update on public.auth_verifications
for each row execute function private.set_updated_at();
