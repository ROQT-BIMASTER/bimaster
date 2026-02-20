-- Temporarily create function to reset password, then drop it
-- Using Supabase's built-in auth function
SELECT auth.uid(); -- just verify context

-- Update user password using crypt
UPDATE auth.users 
SET encrypted_password = crypt('Milene#2026', gen_salt('bf'))
WHERE id = '7eb17733-d824-4758-8ddf-7b9606ef4991';
