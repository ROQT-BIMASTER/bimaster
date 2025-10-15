-- ============================================================================
-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA
-- ============================================================================

-- 1. CORREÇÃO: Exposição de Dados de PROSPECTS
-- Remove políticas permissivas existentes
DROP POLICY IF EXISTS "Acesso total prospects - SELECT" ON public.prospects;
DROP POLICY IF EXISTS "Acesso total prospects - INSERT" ON public.prospects;
DROP POLICY IF EXISTS "Acesso total prospects - UPDATE" ON public.prospects;
DROP POLICY IF EXISTS "Acesso total prospects - DELETE" ON public.prospects;

-- Cria políticas seguras baseadas em território e hierarquia
CREATE POLICY "Vendedores veem apenas seus prospects" 
ON public.prospects 
FOR SELECT 
USING (
  vendedor_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.usuario_prospects up
    WHERE up.usuario_id = auth.uid() 
    AND up.prospect_id = prospects.id
  )
  OR is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Vendedores criam prospects para si mesmos" 
ON public.prospects 
FOR INSERT 
WITH CHECK (
  vendedor_id = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Vendedores atualizam apenas seus prospects" 
ON public.prospects 
FOR UPDATE 
USING (
  vendedor_id = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Apenas admins deletam prospects" 
ON public.prospects 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- 2. CORREÇÃO: Exposição de Dados de ATIVIDADES
-- Remove políticas permissivas existentes
DROP POLICY IF EXISTS "Acesso total atividades - SELECT" ON public.atividades;
DROP POLICY IF EXISTS "Acesso total atividades - INSERT" ON public.atividades;
DROP POLICY IF EXISTS "Acesso total atividades - UPDATE" ON public.atividades;
DROP POLICY IF EXISTS "Acesso total atividades - DELETE" ON public.atividades;

-- Cria políticas seguras baseadas no vendedor responsável
CREATE POLICY "Vendedores veem apenas suas atividades" 
ON public.atividades 
FOR SELECT 
USING (
  vendedor_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.prospects p
    WHERE p.id = atividades.prospect_id 
    AND (p.vendedor_id = auth.uid() OR usuario_tem_acesso_prospect(auth.uid(), p.id))
  )
  OR is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Vendedores criam atividades para seus prospects" 
ON public.atividades 
FOR INSERT 
WITH CHECK (
  vendedor_id = auth.uid() 
  AND (
    EXISTS (
      SELECT 1 FROM public.prospects p
      WHERE p.id = prospect_id 
      AND (p.vendedor_id = auth.uid() OR usuario_tem_acesso_prospect(auth.uid(), p.id))
    )
    OR is_admin_or_supervisor(auth.uid())
  )
);

CREATE POLICY "Vendedores atualizam apenas suas atividades" 
ON public.atividades 
FOR UPDATE 
USING (
  vendedor_id = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Vendedores deletam apenas suas atividades" 
ON public.atividades 
FOR DELETE 
USING (
  vendedor_id = auth.uid() 
  OR is_admin_or_supervisor(auth.uid())
);

-- 3. CORREÇÃO: Exposição de AI INSIGHTS
-- Remove política permissiva existente
DROP POLICY IF EXISTS "Acesso total ai_insights" ON public.ai_insights;

-- Cria políticas seguras baseadas em hierarquia e entidade
CREATE POLICY "Usuários veem insights de suas entidades" 
ON public.ai_insights 
FOR SELECT 
USING (
  -- Admins e supervisores veem tudo
  is_admin_or_supervisor(auth.uid())
  OR
  -- Vendedores veem insights relacionados aos seus prospects
  (
    entity_type = 'prospect' 
    AND EXISTS (
      SELECT 1 FROM public.prospects p
      WHERE p.id = ai_insights.entity_id 
      AND (p.vendedor_id = auth.uid() OR usuario_tem_acesso_prospect(auth.uid(), p.id))
    )
  )
  OR
  -- Vendedores veem insights relacionados às suas lojas
  (
    entity_type = 'store' 
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = ai_insights.entity_id 
      AND s.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Apenas admins e supervisores gerenciam insights" 
ON public.ai_insights 
FOR ALL 
USING (is_admin_or_supervisor(auth.uid()));

-- Adiciona índices para melhorar performance das novas políticas
CREATE INDEX IF NOT EXISTS idx_prospects_vendedor_id ON public.prospects(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_prospects_municipio_id ON public.prospects(municipio_id);
CREATE INDEX IF NOT EXISTS idx_atividades_vendedor_id ON public.atividades(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_atividades_prospect_id ON public.atividades(prospect_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_entity ON public.ai_insights(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_usuario_prospects_usuario ON public.usuario_prospects(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_prospects_prospect ON public.usuario_prospects(prospect_id);