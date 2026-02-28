
-- 1. Create fabrica_revisao_documentos table
CREATE TABLE public.fabrica_revisao_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id uuid REFERENCES public.fabrica_ficha_custo_revisoes(id),
  produto_id uuid NOT NULL,
  mensagem_id uuid REFERENCES public.fabrica_revisao_mensagens(id),
  nome_arquivo text NOT NULL,
  arquivo_path text NOT NULL,
  tipo_arquivo text NOT NULL,
  tamanho integer DEFAULT 0,
  categoria text DEFAULT 'geral',
  status text DEFAULT 'ativo',
  aprovado_por uuid,
  aprovado_em timestamptz,
  enviado_por uuid,
  enviado_por_nome text,
  created_at timestamptz DEFAULT now()
);

-- 2. Add anexos column to fabrica_revisao_mensagens
ALTER TABLE public.fabrica_revisao_mensagens ADD COLUMN IF NOT EXISTS anexos jsonb DEFAULT '[]'::jsonb;

-- 3. Enable RLS
ALTER TABLE public.fabrica_revisao_documentos ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies using can_access_fabrica(auth.uid())
CREATE POLICY "fabrica_revisao_documentos_select" ON public.fabrica_revisao_documentos
  FOR SELECT USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_revisao_documentos_insert" ON public.fabrica_revisao_documentos
  FOR INSERT WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_revisao_documentos_update" ON public.fabrica_revisao_documentos
  FOR UPDATE USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_revisao_documentos_delete" ON public.fabrica_revisao_documentos
  FOR DELETE USING (public.can_access_fabrica(auth.uid()));

-- 5. Create private bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('fabrica-revisao-docs', 'fabrica-revisao-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS policies
CREATE POLICY "fabrica_revisao_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'fabrica-revisao-docs' AND auth.role() = 'authenticated');

CREATE POLICY "fabrica_revisao_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fabrica-revisao-docs' AND auth.role() = 'authenticated');

CREATE POLICY "fabrica_revisao_docs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'fabrica-revisao-docs' AND auth.role() = 'authenticated');

CREATE POLICY "fabrica_revisao_docs_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'fabrica-revisao-docs' AND auth.role() = 'authenticated');

-- 7. Indexes
CREATE INDEX idx_fabrica_revisao_documentos_produto ON public.fabrica_revisao_documentos(produto_id);
CREATE INDEX idx_fabrica_revisao_documentos_revisao ON public.fabrica_revisao_documentos(revisao_id);
CREATE INDEX idx_fabrica_revisao_documentos_status ON public.fabrica_revisao_documentos(status);

-- 8. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fabrica_revisao_documentos;
