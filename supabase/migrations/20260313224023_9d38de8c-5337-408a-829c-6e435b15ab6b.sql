
-- Enum for checklist types
DO $$ BEGIN
  CREATE TYPE public.checklist_arte_tipo AS ENUM (
    'etiqueta_bula', 'etiqueta_fundo', 'tester', 'etiqueta_teste', 'display'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Enum for stages
DO $$ BEGIN
  CREATE TYPE public.fluxo_arte_etapa AS ENUM (
    'criacao', 'embalagem', 'desenvolvimento', 'regulatorio', 'af_final'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Enum for general status
DO $$ BEGIN
  CREATE TYPE public.fluxo_arte_status AS ENUM (
    'em_andamento', 'aprovado', 'reprovado', 'aguardando'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.produto_fluxo_artes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id text NOT NULL,
  sku text NOT NULL,
  produto_nome text NOT NULL DEFAULT '',
  linha_marca text,
  tipo_checklist checklist_arte_tipo NOT NULL,
  numero_documento text,
  etapa_atual fluxo_arte_etapa NOT NULL DEFAULT 'criacao',
  status_geral fluxo_arte_status NOT NULL DEFAULT 'aguardando',
  numero_rodada int NOT NULL DEFAULT 1,
  campos_especificos jsonb NOT NULL DEFAULT '{}',
  aprovacoes jsonb NOT NULL DEFAULT '[]',
  historico jsonb NOT NULL DEFAULT '[]',
  regulatorio_checklist jsonb NOT NULL DEFAULT '[]',
  arte_final_url text,
  faca_url text,
  fotos_referencia text[] NOT NULL DEFAULT '{}',
  data_af_recebida timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Colors table
CREATE TABLE IF NOT EXISTS public.produto_fluxo_artes_cores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fluxo_id uuid NOT NULL REFERENCES public.produto_fluxo_artes(id) ON DELETE CASCADE,
  codigo_cor text NOT NULL,
  pantone_ref text,
  cor_hex text,
  swatch_url text,
  arte_url text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fluxo_artes_produto ON public.produto_fluxo_artes(produto_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_artes_tipo ON public.produto_fluxo_artes(tipo_checklist);
CREATE INDEX IF NOT EXISTS idx_fluxo_artes_status ON public.produto_fluxo_artes(status_geral);
CREATE INDEX IF NOT EXISTS idx_fluxo_artes_cores_fluxo ON public.produto_fluxo_artes_cores(fluxo_id);

-- RLS
ALTER TABLE public.produto_fluxo_artes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_fluxo_artes_cores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_fluxo_artes"
  ON public.produto_fluxo_artes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage produto_fluxo_artes_cores"
  ON public.produto_fluxo_artes_cores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('fluxo-artes', 'fluxo-artes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to fluxo-artes"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fluxo-artes');

CREATE POLICY "Public read access to fluxo-artes"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'fluxo-artes');

CREATE POLICY "Authenticated users can delete from fluxo-artes"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fluxo-artes');
