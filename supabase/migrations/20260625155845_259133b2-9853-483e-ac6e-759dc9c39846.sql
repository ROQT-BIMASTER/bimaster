CREATE OR REPLACE FUNCTION public.rpc_distribuir_verba(p_period_id uuid, p_alocacoes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_teto numeric(14,2);
  v_soma numeric(14,2) := 0;
  v_item jsonb;
  v_dep uuid;
  v_valor numeric(14,2);
  v_dist_id uuid;
  v_planejado numeric(14,2);
BEGIN
  IF NOT public.is_dept_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o Financeiro pode distribuir verba'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Passo 1: lock no período
  SELECT valor_total_empresa INTO v_teto
    FROM public.budget_periods
    WHERE id = p_period_id
    FOR UPDATE;

  IF v_teto IS NULL THEN
    RAISE EXCEPTION 'Período % não encontrado', p_period_id;
  END IF;

  -- Passo 2: somar
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alocacoes)
  LOOP
    v_valor := COALESCE((v_item->>'valor')::numeric, 0);
    IF v_valor < 0 THEN
      RAISE EXCEPTION 'Valor negativo não permitido';
    END IF;
    v_soma := v_soma + v_valor;
  END LOOP;

  IF v_soma > v_teto THEN
    RAISE EXCEPTION 'Soma da distribuição (R$ %) excede o teto da empresa (R$ %)', v_soma, v_teto
      USING ERRCODE = 'check_violation';
  END IF;

  -- Passo 3+4: upsert por departamento, travando a distribution e validando contra o planejado
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alocacoes)
  LOOP
    v_dep := (v_item->>'department_id')::uuid;
    v_valor := COALESCE((v_item->>'valor')::numeric, 0);

    -- Passo 3: UPSERT que TRAVA a linha da distribution
    INSERT INTO public.budget_distributions
      (period_id, department_id, valor_alocado, status, aprovado_por, aprovado_em)
    VALUES
      (p_period_id, v_dep, v_valor, 'aprovada', auth.uid(), now())
    ON CONFLICT (period_id, department_id) DO UPDATE
      SET valor_alocado = EXCLUDED.valor_alocado,
          status        = 'aprovada',
          aprovado_por  = auth.uid(),
          aprovado_em   = now()
    RETURNING id INTO v_dist_id;

    -- Passo 4: travar as linhas planejadas ANTES de agregar
    -- (FOR UPDATE não é permitido junto com funções de agregação)
    PERFORM 1
      FROM public.budget_plan_categories
      WHERE distribution_id = v_dist_id
      FOR UPDATE;

    SELECT COALESCE(SUM(valor_planejado), 0)
      INTO v_planejado
      FROM public.budget_plan_categories
      WHERE distribution_id = v_dist_id;

    IF v_valor < v_planejado THEN
      RAISE EXCEPTION
        'Não é possível alocar R$ % ao departamento %: já há R$ % planejados em categorias',
        v_valor, v_dep, v_planejado
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
END;
$function$;

NOTIFY pgrst, 'reload schema';