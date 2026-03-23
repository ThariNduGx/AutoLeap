-- Initial schema placeholder
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text
);
