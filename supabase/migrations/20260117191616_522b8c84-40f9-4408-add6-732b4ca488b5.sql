-- ============================================
-- CORREÇÃO DE SEGURANÇA: Políticas com true em INSERT/UPDATE/DELETE
-- ============================================

-- 1. Corrigir ai_call_actions (ALL com true)
DROP POLICY IF EXISTS "Acesso a ações via call" ON ai_call_actions;
CREATE POLICY "Supervisores podem gerenciar ações de chamadas"
ON ai_call_actions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Vendedores podem ver ações de suas chamadas"
ON ai_call_actions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ai_calls 
  WHERE ai_calls.id = ai_call_actions.call_id 
  AND ai_calls.vendedor_id = auth.uid()
));

-- 2. Corrigir ai_call_transcriptions (ALL com true)
DROP POLICY IF EXISTS "Acesso a transcrições via call" ON ai_call_transcriptions;
CREATE POLICY "Supervisores podem gerenciar transcrições"
ON ai_call_transcriptions FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Vendedores podem ver transcrições de suas chamadas"
ON ai_call_transcriptions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM ai_calls 
  WHERE ai_calls.id = ai_call_transcriptions.call_id 
  AND ai_calls.vendedor_id = auth.uid()
));

-- 3. Corrigir cnpjbiz_cache (ALL com true)
DROP POLICY IF EXISTS "cnpjbiz_cache_service_only" ON cnpjbiz_cache;
CREATE POLICY "Admins podem gerenciar cache CNPJ"
ON cnpjbiz_cache FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));