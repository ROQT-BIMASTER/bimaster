-- Corrigir 5 funções sem search_path

-- 1. atualizar_custo_produto
CREATE OR REPLACE FUNCTION public.atualizar_custo_produto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_custo_novo NUMERIC;
  v_metodo_custeio VARCHAR(20);
BEGIN
  -- Buscar método de custeio do produto
  SELECT metodo_custeio INTO v_metodo_custeio
  FROM public.fabrica_materias_primas
  WHERE id = NEW.produto_id;
  
  -- Calcular novo custo baseado no método
  IF v_metodo_custeio = 'FIFO' THEN
    v_custo_novo := public.calcular_custo_medio_ponderado(NEW.produto_id);
  ELSE
    v_custo_novo := public.calcular_custo_medio_ponderado(NEW.produto_id);
  END IF;
  
  -- Atualizar custo unitário do produto
  UPDATE public.fabrica_materias_primas
  SET 
    custo_unitario = v_custo_novo,
    preco_medio_ponderado = v_custo_novo,
    updated_at = now()
  WHERE id = NEW.produto_id;
  
  RETURN NEW;
END;
$function$;

-- 2. atualizar_status_lote
CREATE OR REPLACE FUNCTION public.atualizar_status_lote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF NEW.quantidade_atual <= 0 THEN
    NEW.status := 'esgotado';
  END IF;
  
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 3. calcular_custo_medio_fifo
CREATE OR REPLACE FUNCTION public.calcular_custo_medio_fifo(p_produto_id uuid, p_quantidade_saida numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_custo_total NUMERIC := 0;
  v_quantidade_restante NUMERIC := p_quantidade_saida;
  v_lote RECORD;
BEGIN
  -- Buscar lotes do mais antigo para o mais novo (FIFO)
  FOR v_lote IN 
    SELECT id, quantidade_atual, custo_unitario
    FROM public.fabrica_lotes
    WHERE produto_id = p_produto_id 
      AND status = 'ativo' 
      AND quantidade_atual > 0
    ORDER BY created_at ASC
  LOOP
    IF v_quantidade_restante <= 0 THEN
      EXIT;
    END IF;
    
    IF v_lote.quantidade_atual >= v_quantidade_restante THEN
      v_custo_total := v_custo_total + (v_quantidade_restante * v_lote.custo_unitario);
      v_quantidade_restante := 0;
    ELSE
      v_custo_total := v_custo_total + (v_lote.quantidade_atual * v_lote.custo_unitario);
      v_quantidade_restante := v_quantidade_restante - v_lote.quantidade_atual;
    END IF;
  END LOOP;
  
  IF v_quantidade_restante > 0 THEN
    RAISE EXCEPTION 'Quantidade insuficiente em estoque';
  END IF;
  
  RETURN v_custo_total / p_quantidade_saida;
END;
$function$;

-- 4. calcular_custo_medio_ponderado
CREATE OR REPLACE FUNCTION public.calcular_custo_medio_ponderado(p_produto_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_custo_total NUMERIC := 0;
  v_quantidade_total NUMERIC := 0;
BEGIN
  SELECT 
    COALESCE(SUM(quantidade_atual * custo_unitario), 0),
    COALESCE(SUM(quantidade_atual), 0)
  INTO v_custo_total, v_quantidade_total
  FROM public.fabrica_lotes
  WHERE produto_id = p_produto_id 
    AND status = 'ativo' 
    AND quantidade_atual > 0;
  
  IF v_quantidade_total = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_custo_total / v_quantidade_total;
END;
$function$;

-- 5. get_analise_departamentos_completa
CREATE OR REPLACE FUNCTION public.get_analise_departamentos_completa(p_periodo_inicio date, p_periodo_fim date)
 RETURNS TABLE(departamento_id uuid, departamento_nome character varying, tipo character varying, valor_total numeric, total_transacoes bigint, periodo_mes date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as departamento_id,
    d.nome::varchar as departamento_nome,
    'despesa'::varchar as tipo,
    COALESCE(SUM(cp.valor_original), 0) as valor_total,
    COUNT(cp.id) as total_transacoes,
    DATE_TRUNC('month', cp.data_vencimento)::date as periodo_mes
  FROM public.departamentos d
  LEFT JOIN public.contas_pagar cp ON cp.departamento_id = d.id
    AND cp.data_vencimento >= p_periodo_inicio
    AND cp.data_vencimento <= p_periodo_fim
  WHERE d.ativo = true
  GROUP BY d.id, d.nome, DATE_TRUNC('month', cp.data_vencimento)
  
  UNION ALL
  
  SELECT 
    d.id as departamento_id,
    d.nome::varchar as departamento_nome,
    tf.tipo::varchar,
    COALESCE(SUM(tf.valor), 0) as valor_total,
    COUNT(tf.id) as total_transacoes,
    DATE_TRUNC('month', tf.data_transacao)::date as periodo_mes
  FROM public.departamentos d
  LEFT JOIN public.transacoes_financeiras tf ON tf.departamento_id = d.id
    AND tf.data_transacao >= p_periodo_inicio
    AND tf.data_transacao <= p_periodo_fim
  WHERE d.ativo = true
  GROUP BY d.id, d.nome, tf.tipo, DATE_TRUNC('month', tf.data_transacao)
  
  ORDER BY periodo_mes, departamento_nome;
END;
$function$;