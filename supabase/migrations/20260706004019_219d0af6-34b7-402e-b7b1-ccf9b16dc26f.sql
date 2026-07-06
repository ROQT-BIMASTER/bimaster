-- Fase 1.A — Propagar classificação e fiscal pela financial_payment_queue.
-- Todas as colunas são opcionais (NULL) e não alteram linhas existentes.
-- chave_acesso_nfe já existe na tabela — não recriar.

ALTER TABLE public.financial_payment_queue
  ADD COLUMN IF NOT EXISTS departamento_id uuid REFERENCES public.departamentos(id),
  ADD COLUMN IF NOT EXISTS plano_contas_id uuid REFERENCES public.trade_chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS categoria_codigo varchar,
  ADD COLUMN IF NOT EXISTS natureza_lancamento varchar,
  ADD COLUMN IF NOT EXISTS numero_documento_fiscal varchar;

-- Guarda contra valores inválidos em natureza_lancamento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_payment_queue_natureza_chk'
  ) THEN
    ALTER TABLE public.financial_payment_queue
      ADD CONSTRAINT financial_payment_queue_natureza_chk
      CHECK (natureza_lancamento IS NULL OR natureza_lancamento IN ('provisionado', 'lancado'));
  END IF;
END $$;

-- Índices parciais para filtros de fila
CREATE INDEX IF NOT EXISTS idx_fpq_departamento_id
  ON public.financial_payment_queue(departamento_id)
  WHERE departamento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fpq_chave_acesso_nfe
  ON public.financial_payment_queue(chave_acesso_nfe)
  WHERE chave_acesso_nfe IS NOT NULL;

-- Documentação inline
COMMENT ON COLUMN public.financial_payment_queue.departamento_id IS
  'FK para departamentos — propagado da origem (Trade/Departamento/Evento). Financeiro pode confirmar/ajustar no aceite. NULL = a definir no aceite.';
COMMENT ON COLUMN public.financial_payment_queue.plano_contas_id IS
  'FK para trade_chart_of_accounts — sugestão da origem. Financeiro confirma no aceite. Em contas_pagar, /incluir resolve plano a partir do codigo_categoria (code).';
COMMENT ON COLUMN public.financial_payment_queue.categoria_codigo IS
  'Code do plano de contas (trade_chart_of_accounts.code). Vira contas_pagar.codigo_categoria no aceite.';
COMMENT ON COLUMN public.financial_payment_queue.natureza_lancamento IS
  '"provisionado" | "lancado". NULL deixa /incluir aplicar o default do banco (lancado).';
COMMENT ON COLUMN public.financial_payment_queue.numero_documento_fiscal IS
  'Número da NF-e (quando XML foi anexado na origem). Vira contas_pagar.numero_documento_fiscal.';
COMMENT ON COLUMN public.financial_payment_queue.chave_acesso_nfe IS
  'Chave de 44 dígitos da NF-e. Mapeada para contas_pagar.chave_nfe no aceite (nomes diferem entre camadas por herança histórica).';