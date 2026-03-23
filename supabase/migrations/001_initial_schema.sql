-- Initial schema: foundation tables (users + businesses)
-- These must exist before all other migrations that reference them.

-- Enable pgvector extension (required for embedding/similarity columns)
create extension if not exists vector;


create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null default '',
  name text not null default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    telegram_bot_token text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
