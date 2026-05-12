
-- Tabela de relatórios persistidos do Copiloto
CREATE TABLE public.china_copilot_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  idioma TEXT NOT NULL CHECK (idioma IN ('pt','en','zh')),
  profundidade TEXT NOT NULL CHECK (profundidade IN ('executivo','completo')),
  markdown TEXT NOT NULL,
  kpis JSONB NOT NULL DEFAULT '{}'::jsonb,
  analytics JSONB NOT NULL DEFAULT '{}'::jsonb,
  submissao_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  pdf_path TEXT,
  gerado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_rel_submissao ON public.china_copilot_relatorios (submissao_id, created_at DESC);
CREATE INDEX idx_copilot_rel_user ON public.china_copilot_relatorios (gerado_por, created_at DESC);

ALTER TABLE public.china_copilot_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth pode ver relatorios copiloto china"
ON public.china_copilot_relatorios
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "admin pode apagar relatorios copiloto china"
ON public.china_copilot_relatorios
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Bucket privado para PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('china-copilot-pdf', 'china-copilot-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth pode ler pdf copiloto china"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'china-copilot-pdf');

CREATE POLICY "admin pode apagar pdf copiloto china"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'china-copilot-pdf' AND has_role(auth.uid(), 'admin'::app_role));
