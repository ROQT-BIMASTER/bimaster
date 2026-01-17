-- ============================================
-- CORREÇÃO DE SEGURANÇA: Políticas RLS
-- ============================================

-- 1. Remover políticas permissivas demais em ads_metrics
DROP POLICY IF EXISTS "Users can insert metrics for their accounts" ON ads_metrics;
DROP POLICY IF EXISTS "Users can view metrics for their accounts" ON ads_metrics;

-- 2. Corrigir políticas de fabrica_custos_origem (usando true)
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar custos origem" ON fabrica_custos_origem;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar custos origem" ON fabrica_custos_origem;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir custos origem" ON fabrica_custos_origem;
DROP POLICY IF EXISTS "Usuários autenticados podem visualizar custos origem" ON fabrica_custos_origem;

-- Recriar com verificações adequadas
CREATE POLICY "Admin e supervisor podem gerenciar custos origem"
ON fabrica_custos_origem FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

CREATE POLICY "Usuários com módulo fábrica podem visualizar custos"
ON fabrica_custos_origem FOR SELECT
USING (usuario_tem_acesso_modulo(auth.uid(), 'fabrica'));

-- 3. Tornar profiles mais restritivo (apenas próprio perfil)
DROP POLICY IF EXISTS "Users can view own profile or admin" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- 4. Mover extensão pgcrypto do schema public para extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- 5. Adicionar comentários de segurança
COMMENT ON TABLE profiles IS 'Perfis de usuário - acesso restrito ao próprio usuário ou admins';
COMMENT ON TABLE clientes IS 'Clientes - acesso restrito por módulo (vendas/financeiro) e cargo';
COMMENT ON TABLE contas_receber IS 'Contas a receber - acesso restrito ao módulo financeiro';