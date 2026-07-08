-- Integração iPaper: saldo disponível do força de vendas (Result).
-- Alimentada pelo erp-sync-engine (rota sync-estoque-live), fonte =
-- dbo.Live_function_EstoqueProdutos() do Ruby_SP — o MESMO número que o
-- vendedor vê no app (estoque − bloqueado − reserva, resolvido pelo Result).
CREATE TABLE IF NOT EXISTS public.erp_estoque_live (
  cod_produto integer PRIMARY KEY,
  cod_fabricante text,
  nome_prod text,
  estoque_disponivel numeric(18,4) NOT NULL DEFAULT 0,
  -- pcvenda_infpro (empresa 6) do Result: bate com o preço do catálogo iPaper
  -- em 99,5% dos itens (validado contra a planilha manual em 08/07/2026)
  preco_venda numeric(18,4),
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_estoque_live_fabricante
  ON public.erp_estoque_live(cod_fabricante);

ALTER TABLE public.erp_estoque_live ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read erp_estoque_live" ON public.erp_estoque_live;
CREATE POLICY "Auth can read erp_estoque_live"
  ON public.erp_estoque_live FOR SELECT TO authenticated
  USING (public.check_user_access());

-- Escrita só via service role (erp-sync-engine); sem policy de INSERT/UPDATE/DELETE.
