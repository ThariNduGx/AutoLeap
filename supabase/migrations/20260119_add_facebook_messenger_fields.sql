-- Add Facebook Messenger integration fields to businesses table
-- Migration: 20260119_add_facebook_messenger_fields.sql

-- First, ensure the businesses table exists
-- If it doesn't exist, create it with essential fields
create table if not exists public.businesses (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    telegram_bot_token text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Add Facebook Messenger credential fields
alter table public.businesses
add column if not exists fb_page_id text,
add column if not exists fb_page_access_token text,
add column if not exists fb_page_name text;

-- Create unique constraint on fb_page_id to prevent duplicate page connections
-- Only one business can connect to a specific Facebook Page
alter table public.businesses
drop constraint if exists businesses_fb_page_id_unique;

alter table public.businesses
add constraint businesses_fb_page_id_unique unique (fb_page_id);

-- Create index on fb_page_id for fast lookups during webhook processing
create index if not exists idx_businesses_fb_page_id 
on public.businesses(fb_page_id) 
where fb_page_id is not null;

-- Add comment for documentation
comment on column public.businesses.fb_page_id is 'Facebook Page ID - unique identifier for the connected page';
comment on column public.businesses.fb_page_access_token is 'Long-lived Facebook Page Access Token for sending messages';
comment on column public.businesses.fb_page_name is 'Display name of the Facebook Page for UI purposes';
