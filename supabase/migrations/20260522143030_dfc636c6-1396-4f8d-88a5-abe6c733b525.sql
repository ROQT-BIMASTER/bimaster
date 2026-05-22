
-- ============================================================
-- docs_tecnicos: catálogo de documentação técnica/arquitetural
-- ============================================================
CREATE TABLE public.docs_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  slug text NOT NULL,
  area text NOT NULL DEFAULT 'arquitetura',
  versao text NOT NULL DEFAULT '1.0',
  descricao text,
  arquivo_storage_path text NOT NULL,
  arquivo_pdf_storage_path text,
  mime_type text NOT NULL DEFAULT 'text/markdown',
  tamanho_bytes integer,
  publicado boolean NOT NULL DEFAULT true,
  publicado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, versao)
);

CREATE INDEX idx_docs_tecnicos_area ON public.docs_tecnicos(area);
CREATE INDEX idx_docs_tecnicos_publicado_em ON public.docs_tecnicos(publicado_em DESC);

ALTER TABLE public.docs_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem docs tecnicos"
ON public.docs_tecnicos FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins inserem docs tecnicos"
ON public.docs_tecnicos FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = criado_por);

CREATE POLICY "Admins atualizam docs tecnicos"
ON public.docs_tecnicos FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem docs tecnicos"
ON public.docs_tecnicos FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_docs_tecnicos_updated
BEFORE UPDATE ON public.docs_tecnicos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- docs_tecnicos_downloads: trilha de auditoria
-- ============================================================
CREATE TABLE public.docs_tecnicos_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.docs_tecnicos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  formato text NOT NULL DEFAULT 'markdown',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_downloads_doc ON public.docs_tecnicos_downloads(doc_id);
CREATE INDEX idx_docs_downloads_created ON public.docs_tecnicos_downloads(created_at DESC);

ALTER TABLE public.docs_tecnicos_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem downloads"
ON public.docs_tecnicos_downloads FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario autenticado registra proprio download"
ON public.docs_tecnicos_downloads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Storage bucket privado
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('docs-tecnicos', 'docs-tecnicos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins leem objetos docs-tecnicos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'docs-tecnicos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins escrevem objetos docs-tecnicos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'docs-tecnicos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam objetos docs-tecnicos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'docs-tecnicos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem objetos docs-tecnicos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'docs-tecnicos' AND public.has_role(auth.uid(), 'admin'));
