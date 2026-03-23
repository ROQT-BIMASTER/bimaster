
-- Tabela de configuração de fonte de dados AP
CREATE TABLE public.ap_data_source_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL DEFAULT 'both' CHECK (source_type IN ('n8n', 'erp_api', 'both')),
  n8n_enabled boolean NOT NULL DEFAULT true,
  erp_api_enabled boolean NOT NULL DEFAULT false,
  auto_sync_interval_minutes integer NOT NULL DEFAULT 60,
  transition_date date,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

-- RLS
ALTER TABLE public.ap_data_source_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ap_data_source_config"
  ON public.ap_data_source_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update ap_data_source_config"
  ON public.ap_data_source_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can insert ap_data_source_config"
  ON public.ap_data_source_config FOR INSERT TO authenticated WITH CHECK (true);

-- Inserir config padrão (N8N ativo + ERP API desativado = both para transição)
INSERT INTO public.ap_data_source_config (source_type, n8n_enabled, erp_api_enabled, notes)
VALUES ('both', true, false, 'Configuração inicial — N8N ativo, ERP API em preparação');
