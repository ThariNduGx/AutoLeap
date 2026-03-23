-- Create appointments table
create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    business_id uuid references public.businesses(id),
    customer_name text not null,
    customer_phone text not null,
    service_type text not null,
    appointment_date date not null,
    appointment_time time not null,
    duration_minutes int default 60,
    google_event_id text,
    status text default 'confirmed',
    created_at timestamptz default now()
);

-- Index for fast lookup by business and date
create index if not exists idx_appointments_business_date 
on public.appointments(business_id, appointment_date);

-- Enable RLS
alter table public.appointments enable row level security;
