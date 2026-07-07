-- =============================================================
-- Base CAIXA de pagamentos (MovimentoConta) + fix RLS centros_custo
-- =============================================================

-- 1) Staging
CREATE TABLE IF NOT EXISTS public.erp_pagamentos_rubysp (
  erp_id           text PRIMARY KEY,
  empresa_id       integer,
  conta_id         text,
  conta_nome       text,
  data_movimento   date,
  valor            numeric(18,2),
  tipo_mov         text CHECK (tipo_mov IN ('saida','entrada')),
  ccusto_id        integer,
  ccusto_nome      text,
  historico_id     integer,
  historico_nome   text,
  complemento      text,
  documento        text,
  forma            integer,
  pedido           text,
  raw              jsonb,
  staged_at        timestamptz NOT NULL DEFAULT now()
);

-- Sem GRANT para authenticated/anon: só service_role escreve/lê.
GRANT ALL ON public.erp_pagamentos_rubysp TO service_role;
ALTER TABLE public.erp_pagamentos_rubysp ENABLE ROW LEVEL SECURITY;
-- Sem policies → nenhum acesso via client.

CREATE INDEX IF NOT EXISTS idx_erp_pagamentos_rubysp_data ON public.erp_pagamentos_rubysp(data_movimento);
CREATE INDEX IF NOT EXISTS idx_erp_pagamentos_rubysp_emp_data ON public.erp_pagamentos_rubysp(empresa_id, data_movimento);

-- 2) Tabela final
CREATE TABLE IF NOT EXISTS public.pagamentos_caixa (
  erp_id           text PRIMARY KEY,
  empresa_id       integer,
  conta_id         text,
  conta_nome       text,
  data_movimento   date NOT NULL,
  valor            numeric(18,2) NOT NULL,
  tipo_mov         text NOT NULL CHECK (tipo_mov IN ('saida','entrada')),
  ccusto_id        integer,
  ccusto_nome      text,
  historico_id     integer,
  historico_nome   text,
  complemento      text,
  documento        text,
  forma            integer,
  pedido           text,
  centro_custo_id  uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  plano_contas_id  uuid REFERENCES public.trade_chart_of_accounts(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pagamentos_caixa TO authenticated;
GRANT ALL ON public.pagamentos_caixa TO service_role;

ALTER TABLE public.pagamentos_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY pagamentos_caixa_select_authorized
  ON public.pagamentos_caixa
  FOR SELECT
  TO authenticated
  USING (public.check_user_access(auth.uid(), 'contas_pagar_revisao'));

-- Sem INSERT/UPDATE/DELETE para authenticated: só service_role escreve via transform.

CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_data ON public.pagamentos_caixa(data_movimento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_emp_data ON public.pagamentos_caixa(empresa_id, data_movimento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_ccusto ON public.pagamentos_caixa(ccusto_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_tipo ON public.pagamentos_caixa(tipo_mov);
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_centro_custo ON public.pagamentos_caixa(centro_custo_id);

-- updated_at trigger
CREATE TRIGGER trg_pagamentos_caixa_updated
BEFORE UPDATE ON public.pagamentos_caixa
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Transform staging → final
CREATE OR REPLACE FUNCTION public.fn_transform_pagamentos_rubysp()
RETURNS TABLE(inseridos integer, atualizados integer, com_centro integer, com_plano integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '300s'
AS $$
DECLARE
  v_upd integer := 0;
  v_ins integer := 0;
  v_cc  integer := 0;
  v_pc  integer := 0;
BEGIN
  -- UPDATE existentes
  UPDATE public.pagamentos_caixa pc SET
    empresa_id       = s.empresa_id,
    conta_id         = s.conta_id,
    conta_nome       = s.conta_nome,
    data_movimento   = s.data_movimento,
    valor            = s.valor,
    tipo_mov         = s.tipo_mov,
    ccusto_id        = s.ccusto_id,
    ccusto_nome      = s.ccusto_nome,
    historico_id     = s.historico_id,
    historico_nome   = s.historico_nome,
    complemento      = s.complemento,
    documento        = s.documento,
    forma            = s.forma,
    pedido           = s.pedido,
    centro_custo_id  = cc.id,
    plano_contas_id  = tc.id,
    updated_at       = now()
  FROM public.erp_pagamentos_rubysp s
  LEFT JOIN public.centros_custo cc            ON cc.erp_code = s.ccusto_id::text
  LEFT JOIN public.trade_chart_of_accounts tc  ON tc.erp_code = s.historico_id::text
  WHERE pc.erp_id = s.erp_id;
  GET DIAGNOSTICS v_upd = ROW_COUNT;

  -- INSERT novos
  INSERT INTO public.pagamentos_caixa (
    erp_id, empresa_id, conta_id, conta_nome, data_movimento, valor, tipo_mov,
    ccusto_id, ccusto_nome, historico_id, historico_nome,
    complemento, documento, forma, pedido, centro_custo_id, plano_contas_id
  )
  SELECT
    s.erp_id, s.empresa_id, s.conta_id, s.conta_nome, s.data_movimento, s.valor, s.tipo_mov,
    s.ccusto_id, s.ccusto_nome, s.historico_id, s.historico_nome,
    s.complemento, s.documento, s.forma, s.pedido, cc.id, tc.id
  FROM public.erp_pagamentos_rubysp s
  LEFT JOIN public.centros_custo cc            ON cc.erp_code = s.ccusto_id::text
  LEFT JOIN public.trade_chart_of_accounts tc  ON tc.erp_code = s.historico_id::text
  WHERE NOT EXISTS (SELECT 1 FROM public.pagamentos_caixa pc WHERE pc.erp_id = s.erp_id)
  ON CONFLICT (erp_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  SELECT
    count(*) FILTER (WHERE centro_custo_id IS NOT NULL),
    count(*) FILTER (WHERE plano_contas_id IS NOT NULL)
  INTO v_cc, v_pc
  FROM public.pagamentos_caixa;

  inseridos := v_ins;
  atualizados := v_upd;
  com_centro := v_cc;
  com_plano := v_pc;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_transform_pagamentos_rubysp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_transform_pagamentos_rubysp() TO service_role;

-- 4) FIX centros_custo: catálogo compartilhado (a origem é apenas empresa 1)
DROP POLICY IF EXISTS centros_custo_select_empresa ON public.centros_custo;
CREATE POLICY centros_custo_select_all_auth
  ON public.centros_custo
  FOR SELECT
  TO authenticated
  USING (true);
