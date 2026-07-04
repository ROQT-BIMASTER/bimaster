-- 1) Dimensão natureza em contas_pagar
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS natureza_lancamento text NOT NULL DEFAULT 'lancado'
  CHECK (natureza_lancamento IN ('provisionado','lancado'));

COMMENT ON COLUMN public.contas_pagar.natureza_lancamento IS
  'provisionado = previsão (Result Status_Tpg=0), NÃO é dívida firme; lancado = dívida contratada (Status_Tpg=2/5). Legado assumido como lancado.';

CREATE INDEX IF NOT EXISTS idx_contas_pagar_natureza
  ON public.contas_pagar (natureza_lancamento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_natureza_venc
  ON public.contas_pagar (natureza_lancamento, data_vencimento);

-- 2) Lookup de status do ERP
CREATE TABLE IF NOT EXISTS public.financeiro_status_erp (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  erp               text NOT NULL DEFAULT 'result',
  erp_status_codigo text NOT NULL,
  erp_status_label  text,
  status_huugs      text NOT NULL,
  natureza          text NOT NULL CHECK (natureza IN ('provisionado','lancado')),
  observacao        text,
  ativo             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (erp, erp_status_codigo)
);

GRANT SELECT ON public.financeiro_status_erp TO authenticated;
GRANT ALL    ON public.financeiro_status_erp TO service_role;

ALTER TABLE public.financeiro_status_erp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "financeiro_status_erp_sel" ON public.financeiro_status_erp
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.financeiro_status_erp
  (erp, erp_status_codigo, erp_status_label, status_huugs, natureza, observacao) VALUES
  ('result','0','Provisionado (previsão)','PENDENTE','provisionado','Não é dívida firme'),
  ('result','2','Lançado (dívida firme)', 'PENDENTE','lancado',     'Dívida em aberto; VENCIDO derivado por data'),
  ('result','5','Pago',                    'PAGO',    'lancado',     'Título quitado'),
  ('result','C','Cancelado',               'CANCELADO','lancado',    'Título cancelado')
ON CONFLICT (erp, erp_status_codigo) DO NOTHING;