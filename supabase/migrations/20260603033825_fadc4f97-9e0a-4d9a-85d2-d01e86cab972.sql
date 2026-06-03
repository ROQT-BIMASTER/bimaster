-- PR-3a: Modelo de dados da controladoria RR (tabelas-espelho Notion)

CREATE TABLE IF NOT EXISTS public.rr_linhas (
  notion_page_id text PRIMARY KEY,
  nome text, marca text, status text,
  fabricante text, cnpj_fabricante text, afe_fabricante text,
  selos text[], origem text, publico_alvo text, sac text,
  pct_composicao numeric, pct_ean numeric, pct_anvisa numeric,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rr_produtos (
  notion_page_id text PRIMARY KEY,
  sku text, nome_comercial text, marca text, categoria text, status text,
  composicao_pt boolean, composicao_en boolean, anvisa text,
  linha_notion_id text, ultima_revisao_regulatoria date,
  wf jsonb,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_produtos_marca  ON public.rr_produtos(marca);
CREATE INDEX IF NOT EXISTS idx_rr_produtos_linha  ON public.rr_produtos(linha_notion_id);
CREATE INDEX IF NOT EXISTS idx_rr_produtos_status ON public.rr_produtos(status);

CREATE TABLE IF NOT EXISTS public.rr_variantes (
  notion_page_id text PRIMARY KEY,
  nome_tom text, sku_individual text, codigo_tom text, pantone text,
  ean_unitario text, ean_provador text, status text,
  produto_notion_id text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_variantes_produto ON public.rr_variantes(produto_notion_id);

CREATE TABLE IF NOT EXISTS public.rr_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banco text NOT NULL,
  upserts int, status text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rr_linhas, public.rr_produtos, public.rr_variantes, public.rr_sync_log TO authenticated;
GRANT ALL ON public.rr_linhas, public.rr_produtos, public.rr_variantes, public.rr_sync_log TO service_role;

ALTER TABLE public.rr_linhas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_produtos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rr_sync_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rr_linhas_read"    ON public.rr_linhas    FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_produtos_read"  ON public.rr_produtos  FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_variantes_read" ON public.rr_variantes FOR SELECT TO authenticated USING (true);
CREATE POLICY "rr_sync_log_read"  ON public.rr_sync_log  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
