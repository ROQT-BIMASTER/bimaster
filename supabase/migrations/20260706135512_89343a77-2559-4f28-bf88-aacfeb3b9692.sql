-- Fase 2 Orçamento Corporativo: consumo on-the-fly a partir de contas_pagar.
-- Não altera tabelas, RPCs existentes nem triggers. Apenas função + rebind da view.

CREATE OR REPLACE FUNCTION public.fn_orcamento_saldos(p_period_id uuid)
RETURNS TABLE (
  distribution_id      uuid,
  period_id            uuid,
  department_id        uuid,
  department_nome      text,
  valor_alocado        numeric,
  valor_planejado      numeric,
  saldo_reservado      numeric,
  valor_comprometido   numeric,
  valor_utilizado      numeric,
  valor_pago           numeric,
  em_fila              numeric,
  saldo_livre          numeric,
  pct_consumido        numeric,
  estagio              text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_full_access boolean := false;
  v_ini date;
  v_fim date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;  -- 0 linhas para anônimo
  END IF;

  SELECT p.data_inicio, p.data_fim
    INTO v_ini, v_fim
  FROM public.budget_periods p
  WHERE p.id = p_period_id;

  IF v_ini IS NULL THEN
    RETURN;  -- período inexistente => 0 linhas (não quebra a view)
  END IF;

  -- Acesso "full": admin (via has_role) ou usuário com acesso ao módulo financeiro.
  v_full_access := public.check_user_access(v_uid, 'financeiro') OR public.has_role(v_uid, 'admin');

  -- Linhas por distribuição existente no período
  RETURN QUERY
  WITH per AS (
    SELECT v_ini AS ini, v_fim AS fim
  ),
  dists AS (
    SELECT d.id, d.department_id, d.valor_alocado
    FROM public.budget_distributions d
    WHERE d.period_id = p_period_id
      AND (
        v_full_access
        OR public.has_dept_role(v_uid, d.department_id, 'gestor'::public.dept_member_role)
      )
  ),
  plano AS (
    SELECT bpc.distribution_id,
           COALESCE(SUM(bpc.valor_planejado), 0)                                          AS valor_planejado,
           COALESCE(SUM(bpc.valor_planejado) FILTER (WHERE bpc.is_reserva), 0)            AS saldo_reservado
    FROM public.budget_plan_categories bpc
    WHERE bpc.distribution_id IN (SELECT id FROM dists)
    GROUP BY bpc.distribution_id
  ),
  cp_agg AS (
    SELECT cp.departamento_id,
           COALESCE(SUM(cp.valor_original) FILTER (WHERE cp.natureza_lancamento = 'provisionado'), 0) AS comprometido,
           COALESCE(SUM(cp.valor_original) FILTER (WHERE cp.natureza_lancamento = 'lancado'),      0) AS utilizado,
           COALESCE(SUM(cp.valor_pago)     FILTER (WHERE cp.natureza_lancamento = 'lancado'),      0) AS pago
    FROM public.contas_pagar cp, per
    WHERE cp.status <> 'cancelado'
      AND cp.natureza_lancamento IN ('provisionado','lancado')
      AND cp.data_emissao BETWEEN per.ini AND per.fim
    GROUP BY cp.departamento_id
  ),
  fila_agg AS (
    SELECT fpq.departamento_id,
           COALESCE(SUM(fpq.amount), 0) AS em_fila
    FROM public.financial_payment_queue fpq, per
    WHERE fpq.financial_status = 'pending'
      AND COALESCE(fpq.due_date, fpq.created_at::date) BETWEEN per.ini AND per.fim
    GROUP BY fpq.departamento_id
  )
  SELECT
    d.id                                                        AS distribution_id,
    p_period_id                                                 AS period_id,
    d.department_id                                             AS department_id,
    dep.nome                                                    AS department_nome,
    d.valor_alocado                                             AS valor_alocado,
    COALESCE(pl.valor_planejado, 0)                             AS valor_planejado,
    COALESCE(pl.saldo_reservado, 0)                             AS saldo_reservado,
    COALESCE(cp.comprometido, 0)                                AS valor_comprometido,
    COALESCE(cp.utilizado, 0)                                   AS valor_utilizado,
    COALESCE(cp.pago, 0)                                        AS valor_pago,
    COALESCE(f.em_fila, 0)                                      AS em_fila,
    d.valor_alocado - COALESCE(cp.comprometido,0) - COALESCE(cp.utilizado,0) AS saldo_livre,
    CASE WHEN d.valor_alocado > 0
         THEN ((COALESCE(cp.comprometido,0) + COALESCE(cp.utilizado,0)) / d.valor_alocado) * 100
         ELSE NULL END                                          AS pct_consumido,
    CASE
      WHEN d.valor_alocado <= 0 THEN 'ok'
      WHEN ((COALESCE(cp.comprometido,0) + COALESCE(cp.utilizado,0)) / d.valor_alocado) * 100 >= 100 THEN 'estourado_100'
      WHEN ((COALESCE(cp.comprometido,0) + COALESCE(cp.utilizado,0)) / d.valor_alocado) * 100 >= 95  THEN 'critico_95'
      WHEN ((COALESCE(cp.comprometido,0) + COALESCE(cp.utilizado,0)) / d.valor_alocado) * 100 >= 80  THEN 'alerta_80'
      ELSE 'ok'
    END                                                         AS estagio
  FROM dists d
  LEFT JOIN public.departamentos dep ON dep.id = d.department_id
  LEFT JOIN plano pl                 ON pl.distribution_id = d.id
  LEFT JOIN cp_agg cp                ON cp.departamento_id = d.department_id
  LEFT JOIN fila_agg f               ON f.departamento_id = d.department_id;

  -- Linha sintética "sem departamento" (somente full access)
  IF v_full_access THEN
    RETURN QUERY
    WITH per AS (SELECT v_ini AS ini, v_fim AS fim),
    cp_null AS (
      SELECT
        COALESCE(SUM(cp.valor_original) FILTER (WHERE cp.natureza_lancamento='provisionado'), 0) AS comprometido,
        COALESCE(SUM(cp.valor_original) FILTER (WHERE cp.natureza_lancamento='lancado'),      0) AS utilizado,
        COALESCE(SUM(cp.valor_pago)     FILTER (WHERE cp.natureza_lancamento='lancado'),      0) AS pago
      FROM public.contas_pagar cp, per
      WHERE cp.status <> 'cancelado'
        AND cp.natureza_lancamento IN ('provisionado','lancado')
        AND cp.data_emissao BETWEEN per.ini AND per.fim
        AND cp.departamento_id IS NULL
    ),
    fila_null AS (
      SELECT COALESCE(SUM(fpq.amount), 0) AS em_fila
      FROM public.financial_payment_queue fpq, per
      WHERE fpq.financial_status = 'pending'
        AND COALESCE(fpq.due_date, fpq.created_at::date) BETWEEN per.ini AND per.fim
        AND fpq.departamento_id IS NULL
    )
    SELECT
      NULL::uuid                          AS distribution_id,
      p_period_id                         AS period_id,
      NULL::uuid                          AS department_id,
      '(sem departamento)'::text          AS department_nome,
      0::numeric                          AS valor_alocado,
      0::numeric                          AS valor_planejado,
      0::numeric                          AS saldo_reservado,
      cp_null.comprometido                AS valor_comprometido,
      cp_null.utilizado                   AS valor_utilizado,
      cp_null.pago                        AS valor_pago,
      fila_null.em_fila                   AS em_fila,
      (0 - cp_null.comprometido - cp_null.utilizado) AS saldo_livre,
      NULL::numeric                       AS pct_consumido,
      'ok'::text                          AS estagio
    FROM cp_null, fila_null
    WHERE (cp_null.comprometido + cp_null.utilizado + cp_null.pago + fila_null.em_fila) > 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_orcamento_saldos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_orcamento_saldos(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_orcamento_saldos(uuid) TO authenticated;

-- Rebind da view — mantém 10 colunas do contrato original (usadas por useBudgetKpis).
-- Descartar e recriar (a lista de colunas continua idêntica) para trocar a fonte.
DROP VIEW IF EXISTS public.vw_budget_distribution_kpis;

CREATE VIEW public.vw_budget_distribution_kpis
WITH (security_invoker = on) AS
SELECT
  s.distribution_id,
  s.period_id,
  s.department_id,
  s.valor_alocado,
  s.valor_planejado,
  s.saldo_reservado,
  s.valor_comprometido,
  s.valor_utilizado,
  s.valor_pago,
  s.saldo_livre
FROM public.budget_periods p
CROSS JOIN LATERAL public.fn_orcamento_saldos(p.id) s
WHERE s.distribution_id IS NOT NULL;

GRANT SELECT ON public.vw_budget_distribution_kpis TO authenticated;

COMMENT ON FUNCTION public.fn_orcamento_saldos(uuid) IS
  'Fase 2 Orçamento Corporativo: consumo on-the-fly a partir de contas_pagar. Guard como filtro de linha: financeiro/admin veem tudo + linha sintética; gestor vê apenas seu departamento; demais 0 linhas. Não usar em trigger.';
