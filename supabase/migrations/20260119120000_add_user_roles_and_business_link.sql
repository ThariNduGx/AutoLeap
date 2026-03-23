-- Add role-based authentication and user-business linking.
-- This migration is safe for databases with pre-existing businesses/users rows.

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'business');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'business',
  ADD COLUMN IF NOT EXISTS business_id uuid;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.users
SET role = 'business'
WHERE role IS NULL;

UPDATE public.users u
SET business_id = NULL
WHERE business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = u.business_id
  );

UPDATE public.businesses b
SET user_id = NULL
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = b.user_id
  );

DO $$ BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_business_id_fkey
    FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_business_id ON public.users(business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

INSERT INTO public.users (email, password_hash, name, role)
VALUES (
  'admin@autoleap.com',
  '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy',
  'System Administrator',
  'admin'
)
ON CONFLICT (email) DO NOTHING;

COMMENT ON COLUMN public.users.role IS 'User role: admin (platform admin) or business (business owner)';
COMMENT ON COLUMN public.users.business_id IS 'Foreign key to businesses table - which business this user belongs to (null for admins)';
COMMENT ON COLUMN public.businesses.user_id IS 'Foreign key to users table - who created/owns this business';
