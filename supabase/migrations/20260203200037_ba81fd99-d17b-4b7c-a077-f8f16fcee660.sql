-- ============================================
-- CORREÇÃO DE SEGURANÇA: RLS para tabelas expostas
-- ============================================

-- 1. fabrica_limites_preco_tabela - Dados de pricing expostos (CRÍTICO)
ALTER TABLE public.fabrica_limites_preco_tabela ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "fabrica_limites_preco_tabela_select" ON public.fabrica_limites_preco_tabela;
DROP POLICY IF EXISTS "fabrica_limites_preco_tabela_insert" ON public.fabrica_limites_preco_tabela;
DROP POLICY IF EXISTS "fabrica_limites_preco_tabela_update" ON public.fabrica_limites_preco_tabela;
DROP POLICY IF EXISTS "fabrica_limites_preco_tabela_delete" ON public.fabrica_limites_preco_tabela;

-- Apenas usuários com acesso à fábrica podem ver/editar
CREATE POLICY "fabrica_limites_preco_tabela_select" ON public.fabrica_limites_preco_tabela
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_limites_preco_tabela_insert" ON public.fabrica_limites_preco_tabela
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_limites_preco_tabela_update" ON public.fabrica_limites_preco_tabela
  FOR UPDATE TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_limites_preco_tabela_delete" ON public.fabrica_limites_preco_tabela
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. trade_campaign_audit_log - Logs de auditoria expostos (CRÍTICO)
ALTER TABLE public.trade_campaign_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trade_campaign_audit_log_select" ON public.trade_campaign_audit_log;
DROP POLICY IF EXISTS "trade_campaign_audit_log_insert" ON public.trade_campaign_audit_log;
DROP POLICY IF EXISTS "trade_campaign_audit_log_delete" ON public.trade_campaign_audit_log;

-- Função auxiliar para acesso a trade audit
CREATE OR REPLACE FUNCTION public.can_access_trade_audit(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admin ou supervisor via user_roles
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id
      AND ur.role IN ('admin', 'supervisor')
    )
    OR 
    -- Usuário com permissão no módulo trade
    EXISTS (
      SELECT 1 FROM public.usuario_permissoes_modulos upm
      JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = p_user_id
      AND ms.codigo = 'trade'
    );
$$;

-- Apenas admin/supervisor/trade podem ver logs
CREATE POLICY "trade_campaign_audit_log_select" ON public.trade_campaign_audit_log
  FOR SELECT TO authenticated
  USING (public.can_access_trade_audit(auth.uid()));

-- Usuários podem inserir seus próprios logs
CREATE POLICY "trade_campaign_audit_log_insert" ON public.trade_campaign_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Apenas admin pode deletar
CREATE POLICY "trade_campaign_audit_log_delete" ON public.trade_campaign_audit_log
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. fabrica_unidades_medida - Unidades de medida expostas (WARNING)
ALTER TABLE public.fabrica_unidades_medida ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fabrica_unidades_medida_select" ON public.fabrica_unidades_medida;
DROP POLICY IF EXISTS "fabrica_unidades_medida_insert" ON public.fabrica_unidades_medida;
DROP POLICY IF EXISTS "fabrica_unidades_medida_update" ON public.fabrica_unidades_medida;
DROP POLICY IF EXISTS "fabrica_unidades_medida_delete" ON public.fabrica_unidades_medida;

-- Restringir a usuários do módulo fábrica
CREATE POLICY "fabrica_unidades_medida_select" ON public.fabrica_unidades_medida
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_unidades_medida_insert" ON public.fabrica_unidades_medida
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_unidades_medida_update" ON public.fabrica_unidades_medida
  FOR UPDATE TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

CREATE POLICY "fabrica_unidades_medida_delete" ON public.fabrica_unidades_medida
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));