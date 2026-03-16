
-- Add titulo and descricao to fluxo_aprovacao_instancias
ALTER TABLE public.fluxo_aprovacao_instancias 
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS descricao text;

-- Create fluxo_aprovacao_anexos table
CREATE TABLE public.fluxo_aprovacao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  etapa_id uuid REFERENCES public.fluxo_aprovacao_etapas(id),
  nome_arquivo text NOT NULL,
  arquivo_url text NOT NULL,
  tipo text NOT NULL DEFAULT 'documento',
  versao integer NOT NULL DEFAULT 1,
  substituido_por uuid REFERENCES public.fluxo_aprovacao_anexos(id),
  uploaded_by uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create fluxo_aprovacao_vinculos table
CREATE TABLE public.fluxo_aprovacao_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  tipo_vinculo text NOT NULL,
  ref_id text NOT NULL,
  ref_label text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for anexos
ALTER TABLE public.fluxo_aprovacao_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select anexos" ON public.fluxo_aprovacao_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert anexos" ON public.fluxo_aprovacao_anexos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update anexos" ON public.fluxo_aprovacao_anexos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS for vinculos
ALTER TABLE public.fluxo_aprovacao_vinculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can select vinculos" ON public.fluxo_aprovacao_vinculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert vinculos" ON public.fluxo_aprovacao_vinculos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete vinculos" ON public.fluxo_aprovacao_vinculos FOR DELETE TO authenticated USING (true);

-- Storage bucket for approval attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('aprovacao-artes', 'aprovacao-artes', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Authenticated can upload aprovacao files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'aprovacao-artes');
CREATE POLICY "Anyone can view aprovacao files" ON storage.objects FOR SELECT USING (bucket_id = 'aprovacao-artes');
