
CREATE OR REPLACE FUNCTION public.fn_snapshot_plano_contas_batch(
  p_tabela text,
  p_batch  int DEFAULT 20000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '4min'
AS $$
DECLARE
  v_affected int := 0;
BEGIN
  IF p_tabela = 'contas_pagar' THEN
    WITH lote AS (
      SELECT id FROM public.contas_pagar
       WHERE plano_snapshot_at IS NULL
       LIMIT p_batch
    )
    UPDATE public.contas_pagar cp
       SET plano_contas_id_snapshot     = cp.plano_contas_id,
           plano_contas_code_snapshot   = t.code,
           departamento_id_snapshot     = cp.departamento_id,
           departamento_origem_snapshot = cp.departamento_origem,
           plano_snapshot_at            = now()
      FROM lote l
      LEFT JOIN public.trade_chart_of_accounts t ON t.id = public.contas_pagar.plano_contas_id
     WHERE cp.id = l.id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

  ELSIF p_tabela = 'contas_receber' THEN
    WITH lote AS (
      SELECT id FROM public.contas_receber
       WHERE plano_snapshot_at IS NULL
       LIMIT p_batch
    )
    UPDATE public.contas_receber cr
       SET plano_conta_id_snapshot    = cr.plano_conta_id,
           plano_contas_code_snapshot = t.code,
           plano_snapshot_at          = now()
      FROM lote l
      LEFT JOIN public.trade_chart_of_accounts t ON t.id = public.contas_receber.plano_conta_id
     WHERE cr.id = l.id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

  ELSIF p_tabela = 'pagamentos_caixa' THEN
    WITH lote AS (
      SELECT id FROM public.pagamentos_caixa
       WHERE plano_snapshot_at IS NULL
       LIMIT p_batch
    )
    UPDATE public.pagamentos_caixa pc
       SET plano_contas_id_snapshot     = pc.plano_contas_id,
           plano_contas_code_snapshot   = t.code,
           departamento_id_snapshot     = pc.departamento_id,
           departamento_origem_snapshot = pc.departamento_origem,
           plano_snapshot_at            = now()
      FROM lote l
      LEFT JOIN public.trade_chart_of_accounts t ON t.id = public.pagamentos_caixa.plano_contas_id
     WHERE pc.id = l.id;
    GET DIAGNOSTICS v_affected = ROW_COUNT;

  ELSE
    RAISE EXCEPTION 'tabela invalida: %', p_tabela;
  END IF;

  RETURN v_affected;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_snapshot_plano_contas_batch(text,int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.fn_snapshot_plano_contas_batch(text,int) TO service_role;
