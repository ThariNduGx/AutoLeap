-- Add role-based authentication and user-business linking
-- Migration: 20260119_add_user_roles_and_business_link.sql

-- Create role enum type
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'business');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add role column to users table with default 'business'
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'business';

-- Add business_id foreign key to users table
-- This links a business user to their business
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Add user_id to businesses table (the owner/creator of the business)
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

-- Create default admin user
-- Password: AdminPass123! (hashed with bcrypt, cost 10)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO public.users (email, password_hash, name, role)
VALUES (
    'admin@autoleap.com',
    '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy', -- AdminPass123!
    'System Administrator',
    'admin'
)
ON CONFLICT (email) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN public.users.role IS 'User role: admin (platform admin) or business (business owner)';
COMMENT ON COLUMN public.users.business_id IS 'Foreign key to businesses table - which business this user belongs to (null for admins)';
COMMENT ON COLUMN public.businesses.user_id IS 'Foreign key to users table - who created/owns this business';

-- Update existing users to have 'business' role if not set
UPDATE public.users
SET role = 'business'
WHERE role IS NULL;
