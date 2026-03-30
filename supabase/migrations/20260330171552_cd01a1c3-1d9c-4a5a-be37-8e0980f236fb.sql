
-- Remove anonymous/public SELECT policies from private buckets
DROP POLICY IF EXISTS "Public read amostras" ON storage.objects;
DROP POLICY IF EXISTS "Public read embalagem-analise" ON storage.objects;
DROP POLICY IF EXISTS "Public read etiqueta-bula" ON storage.objects;

-- Remove public role policies on campaign-evidence (replace with authenticated-only)
DROP POLICY IF EXISTS "Users can delete their campaign evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their campaign evidence" ON storage.objects;
