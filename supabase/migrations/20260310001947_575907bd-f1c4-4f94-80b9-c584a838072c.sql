
-- Trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('china-documentos', 'china-documentos', false)
ON CONFLICT (id) DO NOTHING;

-- Table: china_produto_submissoes
CREATE TABLE public.china_produto_submissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_codigo text NOT NULL,
  produto_nome text NOT NULL,
  numero_item text,
  numero_ordem text,
  formula_codigo text,
  qty_total integer,
  peso_bruto_g numeric,
  peso_liquido_g numeric,
  peso_tester_g numeric,
  medidas_display jsonb DEFAULT '{}',
  dados_excel jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'rascunho',
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  observacoes_china text,
  observacoes_brasil text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.china_produto_submissoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_sub_select" ON public.china_produto_submissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "china_sub_insert" ON public.china_produto_submissoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "china_sub_update" ON public.china_produto_submissoes FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.check_user_access(auth.uid(), 'fabrica'));

CREATE TRIGGER set_updated_at_china_submissoes BEFORE UPDATE ON public.china_produto_submissoes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Table: china_produto_documentos
CREATE TABLE public.china_produto_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  tipo_documento text NOT NULL,
  arquivo_url text,
  arquivo_path text,
  nome_arquivo text,
  status text NOT NULL DEFAULT 'pendente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.china_produto_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_doc_select" ON public.china_produto_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "china_doc_insert" ON public.china_produto_documentos FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id AND (s.created_by = auth.uid() OR public.check_user_access(auth.uid(), 'fabrica'))));
CREATE POLICY "china_doc_update" ON public.china_produto_documentos FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id AND (s.created_by = auth.uid() OR public.check_user_access(auth.uid(), 'fabrica'))));
CREATE POLICY "china_doc_delete" ON public.china_produto_documentos FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id AND (s.created_by = auth.uid() OR public.check_user_access(auth.uid(), 'fabrica'))));

-- Table: china_produto_cores
CREATE TABLE public.china_produto_cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  cor_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0
);

ALTER TABLE public.china_produto_cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "china_cores_select" ON public.china_produto_cores FOR SELECT TO authenticated USING (true);
CREATE POLICY "china_cores_insert" ON public.china_produto_cores FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id AND (s.created_by = auth.uid() OR public.check_user_access(auth.uid(), 'fabrica'))));
CREATE POLICY "china_cores_delete" ON public.china_produto_cores FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id AND (s.created_by = auth.uid() OR public.check_user_access(auth.uid(), 'fabrica'))));

-- Storage RLS
CREATE POLICY "china_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'china-documentos');
CREATE POLICY "china_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'china-documentos');
CREATE POLICY "china_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'china-documentos');
