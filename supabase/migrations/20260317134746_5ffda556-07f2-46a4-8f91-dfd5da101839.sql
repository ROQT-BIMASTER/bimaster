
-- Pasta Digital table for TJSP-style document tracking
CREATE TABLE public.produto_brasil_pasta_digital (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid NOT NULL,
  fase text NOT NULL DEFAULT 'documentos_diversos',
  titulo text NOT NULL,
  paginas text,
  arquivo_url text,
  arquivo_path text,
  ordem integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.produto_brasil_pasta_digital(id) ON DELETE SET NULL,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  parecer_status text NOT NULL DEFAULT 'pendente',
  parecer_por uuid,
  parecer_data timestamptz,
  parecer_observacao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_brasil_pasta_digital ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pasta digital"
  ON public.produto_brasil_pasta_digital FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pasta digital"
  ON public.produto_brasil_pasta_digital FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pasta digital"
  ON public.produto_brasil_pasta_digital FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete pasta digital"
  ON public.produto_brasil_pasta_digital FOR DELETE TO authenticated USING (true);

-- Storage bucket for pasta digital files
INSERT INTO storage.buckets (id, name, public) VALUES ('pasta-digital', 'pasta-digital', false);

CREATE POLICY "Auth users can upload pasta digital files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pasta-digital');

CREATE POLICY "Auth users can view pasta digital files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pasta-digital');

CREATE POLICY "Auth users can update pasta digital files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pasta-digital');

CREATE POLICY "Auth users can delete pasta digital files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pasta-digital');
