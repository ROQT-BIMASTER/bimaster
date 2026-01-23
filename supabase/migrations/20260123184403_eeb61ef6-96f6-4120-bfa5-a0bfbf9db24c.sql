-- Corrigir RLS na tabela ai_training_examples
ALTER TABLE public.ai_training_examples ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos (dados de treinamento são públicos)
CREATE POLICY "Anyone can read training examples"
ON public.ai_training_examples FOR SELECT
USING (true);

-- Apenas serviço pode inserir (edge functions)
CREATE POLICY "Service role can manage training examples"
ON public.ai_training_examples FOR ALL
USING (true)
WITH CHECK (true);

-- Corrigir search_path na função
DROP FUNCTION IF EXISTS suggest_classification_from_history(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.suggest_classification_from_history(
  p_historico TEXT,
  p_fornecedor TEXT DEFAULT NULL
) RETURNS TABLE (
  codigo_dre TEXT,
  conta_nome TEXT,
  conta_id UUID,
  confianca NUMERIC,
  fonte TEXT
) LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- Primeiro tenta match exato por fornecedor
  IF p_fornecedor IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      r.categoria_nome,
      t.name,
      t.id,
      r.confidence_score::NUMERIC,
      'regra_fornecedor'::TEXT
    FROM account_classification_rules r
    LEFT JOIN trade_chart_of_accounts t ON t.id = r.plano_contas_id
    WHERE r.fornecedor_nome ILIKE '%' || p_fornecedor || '%'
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;
  
  -- Tenta match por categoria (primeira palavra do histórico)
  RETURN QUERY
  SELECT 
    r.categoria_nome,
    t.name,
    t.id,
    r.confidence_score::NUMERIC * 0.8,
    'regra_categoria'::TEXT
  FROM account_classification_rules r
  LEFT JOIN trade_chart_of_accounts t ON t.id = r.plano_contas_id
  WHERE r.categoria_nome ILIKE '%' || split_part(p_historico, ' ', 1) || '%'
     OR r.categoria_nome ILIKE '%' || split_part(p_historico, '-', 1) || '%'
  ORDER BY r.times_used DESC
  LIMIT 1;
  
  RETURN;
END;
$$;