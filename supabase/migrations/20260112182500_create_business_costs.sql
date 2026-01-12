-- Create business_costs table for daily aggregation
create table if not exists public.business_costs (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id),
    date date not null,
    total_cost double precision default 0,
    breakdown jsonb default '{}'::jsonb, -- { "api": 0.5, "storage": 0.1 }
    query_count int default 0,
    cache_hits int default 0,
    created_at timestamptz default now(),
    unique(business_id, date)
);

-- Enable RLS
alter table public.business_costs enable row level security;
