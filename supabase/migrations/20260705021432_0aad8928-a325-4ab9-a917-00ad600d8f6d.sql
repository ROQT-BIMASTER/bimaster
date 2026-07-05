CREATE OR REPLACE FUNCTION public.ap_apply_reclassification_group(
  p_job_group_id uuid,
  p_user_id uuid,
  p_departamento_id uuid,
  p_departamento_nome text,
  p_plano_contas_id uuid,
  p_plano_contas_codigo text,
  p_plano_contas_nome text,
  p_confidence numeric,
  p_justification text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH g AS (
    SELECT *
    FROM public.ap_reclassification_job_groups
    WHERE id = p_job_group_id
  ),
  matched AS MATERIALIZED (
    SELECT
      cp.id,
      jsonb_build_object(
        'departamento_id', cp.departamento_id,
        'departamento_nome', cp.departamento_nome,
        'plano_contas_id', cp.plano_contas_id,
        'plano_contas_codigo', cp.plano_contas_codigo,
        'plano_contas_nome', cp.plano_contas_nome,
        'classificacao_manual', cp.classificacao_manual
      ) AS valor_anterior,
      jsonb_build_object(
        'departamento_id', p_departamento_id,
        'departamento_nome', p_departamento_nome,
        'plano_contas_id', p_plano_contas_id,
        'plano_contas_codigo', p_plano_contas_codigo,
        'plano_contas_nome', p_plano_contas_nome,
        'confianca_classificacao', p_confidence
      ) AS valor_novo
    FROM public.contas_pagar cp
    JOIN g ON true
    WHERE cp.categoria_nome = g.categoria_nome
      AND cp.fornecedor_nome IS NOT DISTINCT FROM g.fornecedor_nome
      AND cp.tipo_documento IS NOT DISTINCT FROM g.tipo_documento
      AND cp.centro_custo_id IS NOT DISTINCT FROM g.centro_custo_id
  ),
  historico AS (
    INSERT INTO public.contas_pagar_historico (
      conta_id,
      campo_alterado,
      valor_anterior,
      valor_novo,
      tipo_alteracao,
      justificativa,
      usuario_id,
      usuario_nome
    )
    SELECT
      id,
      'classificacao_financeira',
      valor_anterior::text,
      valor_novo::text,
      'RECLASSIFICACAO_IA_CC',
      p_justification,
      p_user_id,
      'Reclassificação IA por Centro de Custo'
    FROM matched
    RETURNING 1
  ),
  atualizado AS (
    UPDATE public.contas_pagar cp
    SET
      departamento_id = p_departamento_id,
      departamento_nome = p_departamento_nome,
      plano_contas_id = p_plano_contas_id,
      plano_contas_codigo = p_plano_contas_codigo,
      plano_contas_nome = p_plano_contas_nome,
      confianca_classificacao = p_confidence,
      classificacao_justificativa = p_justification,
      classificado_automaticamente = true,
      classificado_em = now()
    WHERE cp.id IN (SELECT id FROM matched)
    RETURNING cp.id
  )
  SELECT count(*)::integer INTO v_count FROM atualizado;

  RETURN coalesce(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ap_apply_reclassification_group(uuid, uuid, uuid, text, uuid, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ap_apply_reclassification_group(uuid, uuid, uuid, text, uuid, text, text, numeric, text) TO service_role;