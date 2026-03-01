
-- Create table for persisted NF-e XMLs
CREATE TABLE public.fabrica_nfe_xmls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_nf TEXT NOT NULL,
  serie TEXT,
  chave_acesso TEXT UNIQUE,
  data_emissao DATE,
  valor_total NUMERIC,
  fornecedor_cnpj TEXT,
  fornecedor_razao_social TEXT,
  fornecedor_nome_fantasia TEXT,
  produtos JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_path TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fabrica_nfe_xmls ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read all
CREATE POLICY "Authenticated users can read NF-e XMLs"
  ON public.fabrica_nfe_xmls FOR SELECT
  USING (can_access_fabrica(auth.uid()));

-- RLS: authenticated users can insert
CREATE POLICY "Authenticated users can insert NF-e XMLs"
  ON public.fabrica_nfe_xmls FOR INSERT
  WITH CHECK (can_access_fabrica(auth.uid()));

-- Create private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('fabrica-nfe-xmls', 'fabrica-nfe-xmls', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload NF-e XMLs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fabrica-nfe-xmls' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read NF-e XMLs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fabrica-nfe-xmls' AND auth.role() = 'authenticated');
