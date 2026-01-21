-- Update admin user password
-- Run this in Supabase SQL Editor to update the admin password

-- This will update the admin@autoleap.com user with the correct password hash
-- Password: AdminPass123!

UPDATE public.users
SET password_hash = '$2b$10$9K/yNkeDNH2Jls8iuYmM6uZuUoW8H/XNPoAlwiGeRDg43a9ydtfwy'
WHERE email = 'admin@autoleap.com';

-- Verify the update
SELECT email, name, role, password_hash
FROM public.users
WHERE email = 'admin@autoleap.com';
