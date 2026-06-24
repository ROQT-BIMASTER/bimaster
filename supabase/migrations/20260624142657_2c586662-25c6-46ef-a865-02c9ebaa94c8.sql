ALTER TABLE public.china_produto_submissoes
  ADD COLUMN IF NOT EXISTS foto_oficial_url text,
  ADD COLUMN IF NOT EXISTS foto_oficial_path text,
  ADD COLUMN IF NOT EXISTS foto_oficial_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS foto_oficial_uploaded_by uuid;

COMMENT ON COLUMN public.china_produto_submissoes.foto_oficial_url IS 'URL da foto oficial do produto (Fase 3 unificação Submissão↔Projeto).';
COMMENT ON COLUMN public.china_produto_submissoes.foto_oficial_path IS 'Caminho no bucket storage da foto oficial.';