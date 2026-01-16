
-- =====================================================
-- CORREÇÃO - Função sem search_path
-- =====================================================

-- Corrigir calcular_status_financeiro
CREATE OR REPLACE FUNCTION public.calcular_status_financeiro(p_valor_aberto NUMERIC, p_dias_atraso INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_valor_aberto <= 0 THEN
    RETURN 'recebido';
  ELSIF p_dias_atraso > 0 THEN
    RETURN 'vencido';
  ELSE
    RETURN 'pendente';
  END IF;
END;
$$;
