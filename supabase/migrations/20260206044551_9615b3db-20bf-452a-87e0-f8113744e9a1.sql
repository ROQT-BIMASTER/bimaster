
-- Tabela para leads minerados do Google Places
CREATE TABLE public.leads_minerados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  telefone_internacional TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  website TEXT,
  rating NUMERIC,
  total_avaliacoes INTEGER DEFAULT 0,
  tipos TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'novo',
  busca_query TEXT,
  busca_regiao TEXT,
  convertido_prospect_id UUID REFERENCES public.prospects(id),
  cnpj TEXT,
  observacoes TEXT,
  minerado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leads_minerados_google_place_id_key UNIQUE (google_place_id)
);

-- Índices para performance
CREATE INDEX idx_leads_minerados_status ON public.leads_minerados(status);
CREATE INDEX idx_leads_minerados_cidade_uf ON public.leads_minerados(cidade, uf);
CREATE INDEX idx_leads_minerados_minerado_por ON public.leads_minerados(minerado_por);
CREATE INDEX idx_leads_minerados_rating ON public.leads_minerados(rating DESC NULLS LAST);

-- Enable RLS
ALTER TABLE public.leads_minerados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: todos os autenticados podem ler e escrever
CREATE POLICY "Authenticated users can read leads_minerados"
  ON public.leads_minerados FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert leads_minerados"
  ON public.leads_minerados FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update leads_minerados"
  ON public.leads_minerados FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete leads_minerados"
  ON public.leads_minerados FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_leads_minerados_updated_at
  BEFORE UPDATE ON public.leads_minerados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
