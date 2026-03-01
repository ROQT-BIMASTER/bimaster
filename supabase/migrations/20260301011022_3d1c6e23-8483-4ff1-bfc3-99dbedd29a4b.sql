-- Step 2: Remove overly permissive RLS on cofre_share_tokens
DROP POLICY IF EXISTS "Anon can read tokens for validation" ON public.cofre_share_tokens;

-- Step 4: Make fabrica-produto-fotos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'fabrica-produto-fotos';
