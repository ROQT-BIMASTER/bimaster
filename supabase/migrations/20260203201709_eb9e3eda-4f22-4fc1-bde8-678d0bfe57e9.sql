
-- =====================================================
-- POLÍTICA DE SEGURANÇA: DENY BY DEFAULT
-- Apenas admins e permissões INDIVIDUAIS terão acesso
-- Módulos/telas só aparecem quando explicitamente liberados
-- =====================================================

-- Backup: criar tabela de auditoria antes de remover
CREATE TABLE IF NOT EXISTS public.role_permissions_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  permission_type text NOT NULL, -- 'module' ou 'screen'
  permission_code text NOT NULL,
  action text NOT NULL, -- 'removed', 'added'
  reason text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS na tabela de auditoria
ALTER TABLE public.role_permissions_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: apenas admin pode ler/inserir na auditoria
CREATE POLICY "admin_only_audit" ON public.role_permissions_audit_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- REMOVER PERMISSÕES PADRÃO PARA ROLES NÃO-ADMIN
-- =====================================================

-- Registrar remoções na auditoria (módulos supervisor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'supervisor', 'module', ms.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_modulos rpm
JOIN modulos_sistema ms ON ms.id = rpm.modulo_id
WHERE rpm.role = 'supervisor';

-- Registrar remoções na auditoria (telas supervisor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'supervisor', 'screen', ts.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_telas rpt
JOIN telas_sistema ts ON ts.id = rpt.tela_id
WHERE rpt.role = 'supervisor';

-- Registrar remoções na auditoria (módulos vendedor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'vendedor', 'module', ms.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_modulos rpm
JOIN modulos_sistema ms ON ms.id = rpm.modulo_id
WHERE rpm.role = 'vendedor';

-- Registrar remoções na auditoria (telas vendedor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'vendedor', 'screen', ts.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_telas rpt
JOIN telas_sistema ts ON ts.id = rpt.tela_id
WHERE rpt.role = 'vendedor';

-- Registrar remoções na auditoria (módulos promotor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'promotor', 'module', ms.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_modulos rpm
JOIN modulos_sistema ms ON ms.id = rpm.modulo_id
WHERE rpm.role = 'promotor';

-- Registrar remoções na auditoria (telas promotor)
INSERT INTO public.role_permissions_audit_log (role, permission_type, permission_code, action, reason)
SELECT 'promotor', 'screen', ts.codigo, 'removed', 'Política deny-by-default implementada'
FROM role_permissoes_telas rpt
JOIN telas_sistema ts ON ts.id = rpt.tela_id
WHERE rpt.role = 'promotor';

-- =====================================================
-- REMOVER TODAS AS PERMISSÕES POR ROLE (exceto admin)
-- Admin continua com bypass automático no código
-- =====================================================

DELETE FROM role_permissoes_modulos WHERE role IN ('supervisor', 'vendedor', 'promotor');
DELETE FROM role_permissoes_telas WHERE role IN ('supervisor', 'vendedor', 'promotor');

-- =====================================================
-- MANTER APENAS PERMISSÕES BÁSICAS PARA TODOS
-- (instalar_app e dashboard são essenciais)
-- =====================================================

-- Adicionar permissão básica de dashboard para supervisor
INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'supervisor'::app_role, id FROM telas_sistema WHERE codigo = 'dashboard'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'supervisor'::app_role, id FROM telas_sistema WHERE codigo = 'instalar_app'
ON CONFLICT DO NOTHING;

-- Adicionar permissão básica de dashboard para vendedor
INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'vendedor'::app_role, id FROM telas_sistema WHERE codigo = 'dashboard'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'vendedor'::app_role, id FROM telas_sistema WHERE codigo = 'instalar_app'
ON CONFLICT DO NOTHING;

-- Adicionar permissão básica de dashboard para promotor
INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'promotor'::app_role, id FROM telas_sistema WHERE codigo = 'dashboard'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissoes_telas (role, tela_id)
SELECT 'promotor'::app_role, id FROM telas_sistema WHERE codigo = 'instalar_app'
ON CONFLICT DO NOTHING;

-- =====================================================
-- ADICIONAR COMENTÁRIO NA TABELA PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE role_permissoes_modulos IS 'POLÍTICA DENY-BY-DEFAULT: Apenas admin tem permissões automáticas. Outros roles precisam de permissões individuais via usuario_permissoes_modulos.';
COMMENT ON TABLE role_permissoes_telas IS 'POLÍTICA DENY-BY-DEFAULT: Apenas admin tem permissões automáticas. Outros roles precisam de permissões individuais via usuario_permissoes_telas.';
