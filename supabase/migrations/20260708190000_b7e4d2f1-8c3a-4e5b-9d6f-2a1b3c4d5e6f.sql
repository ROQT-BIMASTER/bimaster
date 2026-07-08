-- iPaper: erp_estoque_live passa a ser POR FILIAL (empresa) para permitir
-- limitar quais filiais alimentam o catálogo (decisão 08/07: empresas 6, 9, 10, 11).
-- A fonte muda da Live_function (que não expõe filial) para o cálculo validado
-- por empresa: Estoque_InfPro − Bloqueado − reserva_Infpro (96% dos produtos a
-- ≤5 unidades do força de vendas; diferenças = efeito do próprio filtro de filial).
-- Tabela é espelho descartável do sync — recriar é seguro.
DROP TABLE IF EXISTS public.erp_estoque_live;

CREATE TABLE public.erp_estoque_live (
  erp_id text PRIMARY KEY,          -- "<empresa>-<cod_produto>"
  empresa integer NOT NULL,
  cod_produto integer NOT NULL,
  cod_fabricante text,
  nome_prod text,
  estoque_disponivel numeric(18,4) NOT NULL DEFAULT 0,
  preco_venda numeric(18,4),
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_erp_estoque_live_fabricante ON public.erp_estoque_live(cod_fabricante);
CREATE INDEX idx_erp_estoque_live_produto ON public.erp_estoque_live(cod_produto);

ALTER TABLE public.erp_estoque_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read erp_estoque_live"
  ON public.erp_estoque_live FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'estoque'));

GRANT SELECT ON public.erp_estoque_live TO authenticated;
GRANT ALL ON public.erp_estoque_live TO service_role;

-- ── Crons: estoque do catálogo sempre fresco sem depender de clique ──
-- Sync do disponível por filial de hora em hora (06h–20h BRT = 09–23 UTC)
SELECT cron.schedule(
  'sync-estoque-live-horario',
  '5 9-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/erp-sync-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{"path":"sync-estoque-live"}'::jsonb
  );
  $$
);

-- Push do arquivo XLSX para o iPaper 20 min depois de cada sync
SELECT cron.schedule(
  'ipaper-push-horario',
  '25 9-23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/ipaper-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', public._get_cron_secret()
    ),
    body := '{}'::jsonb
  );
  $$
);
