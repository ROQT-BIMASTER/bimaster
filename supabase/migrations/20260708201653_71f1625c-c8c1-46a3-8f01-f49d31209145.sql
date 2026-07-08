DROP TABLE IF EXISTS public.erp_estoque_live;

CREATE TABLE public.erp_estoque_live (
  erp_id text PRIMARY KEY,
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

GRANT SELECT ON public.erp_estoque_live TO authenticated;
GRANT ALL ON public.erp_estoque_live TO service_role;

ALTER TABLE public.erp_estoque_live ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can read erp_estoque_live"
  ON public.erp_estoque_live FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'estoque'));

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