-- Primeiro dropar o trigger
DROP TRIGGER IF EXISTS update_transacoes_updated_at ON public.transacoes_financeiras;

-- Depois dropar e recriar as funções com search_path correto
DROP FUNCTION IF EXISTS public.refresh_analise_departamentos();
DROP FUNCTION IF EXISTS public.update_transacoes_updated_at();

-- Recriar função de refresh com search_path correto
CREATE FUNCTION public.refresh_analise_departamentos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_analise_departamentos;
END;
$$;

-- Recriar função de trigger com search_path correto
CREATE FUNCTION public.update_transacoes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER update_transacoes_updated_at
  BEFORE UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transacoes_updated_at();

-- Remover a view materializada da API (tornar privada)
REVOKE ALL ON public.mv_analise_departamentos FROM anon, authenticated;

-- Criar função segura para acessar os dados da view
CREATE FUNCTION public.get_analise_departamentos(
  p_periodo_inicio DATE DEFAULT NULL,
  p_periodo_fim DATE DEFAULT NULL,
  p_departamento_id UUID DEFAULT NULL
)
RETURNS TABLE(
  departamento_id UUID,
  departamento_nome VARCHAR,
  periodo_mes TIMESTAMPTZ,
  tipo VARCHAR,
  total_transacoes BIGINT,
  valor_total NUMERIC,
  valor_medio NUMERIC,
  confianca_media NUMERIC,
  classificacoes_automaticas BIGINT,
  classificacoes_manuais BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas admin e supervisor podem acessar
  IF NOT public.is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin e supervisor podem visualizar análises';
  END IF;

  RETURN QUERY
  SELECT 
    mad.departamento_id,
    mad.departamento_nome,
    mad.periodo_mes,
    mad.tipo,
    mad.total_transacoes,
    mad.valor_total,
    mad.valor_medio,
    mad.confianca_media,
    mad.classificacoes_automaticas,
    mad.classificacoes_manuais
  FROM public.mv_analise_departamentos mad
  WHERE 
    (p_periodo_inicio IS NULL OR mad.periodo_mes >= p_periodo_inicio) AND
    (p_periodo_fim IS NULL OR mad.periodo_fim <= p_periodo_fim) AND
    (p_departamento_id IS NULL OR mad.departamento_id = p_departamento_id)
  ORDER BY mad.periodo_mes DESC, mad.departamento_nome;
END;
$$;