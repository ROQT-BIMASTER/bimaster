
-- China Pasta Digital table (TJSP-style document tracking for China submissions)
CREATE TABLE public.china_pasta_digital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  fase text NOT NULL,
  titulo text NOT NULL,
  paginas text,
  arquivo_url text,
  arquivo_path text,
  documento_origem_id uuid REFERENCES public.china_produto_documentos(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.china_pasta_digital(id) ON DELETE SET NULL,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  parecer_status text NOT NULL DEFAULT 'pendente',
  parecer_por uuid,
  parecer_data timestamptz,
  parecer_observacao text,
  despacho_modulo text,
  despacho_descricao text,
  despacho_data timestamptz,
  despacho_por uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indices
CREATE INDEX idx_china_pasta_digital_submissao ON public.china_pasta_digital(submissao_id);
CREATE INDEX idx_china_pasta_digital_fase ON public.china_pasta_digital(submissao_id, fase);
CREATE INDEX idx_china_pasta_digital_parecer ON public.china_pasta_digital(parecer_status);

-- RLS
ALTER TABLE public.china_pasta_digital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view china_pasta_digital"
  ON public.china_pasta_digital FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert china_pasta_digital"
  ON public.china_pasta_digital FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update china_pasta_digital"
  ON public.china_pasta_digital FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete china_pasta_digital"
  ON public.china_pasta_digital FOR DELETE TO authenticated USING (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('china-pasta-digital', 'china-pasta-digital', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users can upload to china-pasta-digital"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'china-pasta-digital');

CREATE POLICY "Auth users can read china-pasta-digital"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'china-pasta-digital');

CREATE POLICY "Auth users can delete china-pasta-digital"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'china-pasta-digital');
