
DROP FUNCTION IF EXISTS public.fn_resolve_plano_dre(integer, integer, text);
DROP FUNCTION IF EXISTS public.fn_resolve_depto_dre(integer, integer, integer);

CREATE OR REPLACE FUNCTION public.fn_resolve_plano_dre(p_ccusto bigint, p_historico bigint, p_complemento text)
RETURNS TABLE(plano_contas_id uuid, plano_code text, departamento text, tesouraria boolean, prioridade integer, regra_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rule RECORD;
BEGIN
  SELECT m.id, m.plano_code, m.departamento, m.prioridade INTO v_rule
  FROM public.erp_dre_mapa m
  WHERE (m.ccusto_id IS NULL OR m.ccusto_id = p_ccusto)
    AND (m.historico_id IS NULL OR m.historico_id = p_historico)
    AND (m.complemento_like IS NULL OR (p_complemento IS NOT NULL AND p_complemento ILIKE m.complemento_like))
  ORDER BY m.prioridade ASC, m.id ASC LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_rule.plano_code = 'EXCLUIR' THEN
    plano_contas_id := NULL; plano_code := NULL;
    departamento := v_rule.departamento; tesouraria := true;
    prioridade := v_rule.prioridade; regra_id := v_rule.id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT t.id INTO plano_contas_id FROM public.trade_chart_of_accounts t WHERE t.code = v_rule.plano_code LIMIT 1;
  plano_code := v_rule.plano_code; departamento := v_rule.departamento;
  tesouraria := false; prioridade := v_rule.prioridade; regra_id := v_rule.id;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.fn_resolve_depto_dre(p_setor bigint, p_ccusto bigint, p_historico bigint)
RETURNS TABLE(departamento_id uuid, departamento text, origem text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_dept text;
BEGIN
  IF p_setor IS NOT NULL AND p_setor > 0 THEN
    SELECT s.departamento INTO v_dept FROM public.erp_setor_depara s WHERE s.setor_id = p_setor LIMIT 1;
    IF v_dept IS NOT NULL THEN
      SELECT v.departamento_id INTO departamento_id FROM public.vw_departamento_canonico v WHERE v.nome_canonico = v_dept LIMIT 1;
      departamento := v_dept; origem := 'setor_erp';
      RETURN NEXT; RETURN;
    END IF;
  END IF;

  SELECT r.departamento INTO v_dept FROM public.fn_resolve_plano_dre(p_ccusto, p_historico, NULL::text) r;
  IF v_dept IS NULL THEN RETURN; END IF;

  SELECT v.departamento_id INTO departamento_id FROM public.vw_departamento_canonico v WHERE v.nome_canonico = v_dept LIMIT 1;
  departamento := v_dept; origem := 'mapa';
  RETURN NEXT;
END; $function$;
