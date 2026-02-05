-- =====================================================
-- MIGRATION: SECURITY HARDENING FOR PRODUCTION
-- =====================================================

-- 1. RECRIAR VIEWS COM security_invoker=on PARA RESPEITAR RLS
-- =====================================================

-- Recriar clientes_safe com security_invoker
DROP VIEW IF EXISTS public.clientes_safe;
CREATE VIEW public.clientes_safe
WITH (security_invoker=on) AS
SELECT 
    id,
    codigo,
    empresa_id,
    nome,
    nome_abreviado,
    cnpj,
    CASE 
        WHEN email IS NOT NULL AND email <> '' 
        THEN concat('***@', split_part(email::text, '@', 2))
        ELSE NULL
    END AS email_masked,
    CASE 
        WHEN telefone IS NOT NULL AND length(telefone::text) > 4 
        THEN concat('***-', right(telefone::text, 4))
        ELSE NULL
    END AS telefone_masked,
    CASE 
        WHEN celular IS NOT NULL AND length(celular::text) > 4 
        THEN concat('***-', right(celular::text, 4))
        ELSE NULL
    END AS celular_masked,
    cidade,
    uf,
    limite_credito,
    classificacao,
    conceito,
    status_bloqueio,
    data_ultima_compra,
    valor_ultima_compra,
    data_maior_compra,
    valor_maior_compra,
    created_at,
    updated_at
FROM clientes;

-- Recriar profiles_safe com security_invoker
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker=on) AS
SELECT 
    id,
    nome,
    status,
    aprovado,
    departamento_id,
    supervisor_id,
    gerente_id,
    created_at,
    updated_at,
    CASE 
        WHEN has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role) 
        THEN email
        ELSE concat(left(email, 3), '***@', right(email, 4))
    END AS email
FROM profiles;

-- 2. CORRIGIR POLÍTICAS PERMISSIVAS (WITH CHECK = true para INSERT/UPDATE/DELETE)
-- =====================================================

-- department_budgets: restringir UPDATE para admins/finance
DROP POLICY IF EXISTS "Allow authenticated users to update department budgets" ON public.department_budgets;
CREATE POLICY "department_budgets_update_restricted"
ON public.department_budgets
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- expense_approval_audit: restringir INSERT para admins/finance
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.expense_approval_audit;
CREATE POLICY "expense_audit_insert_restricted"
ON public.expense_approval_audit
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- financial_payment_queue: restringir INSERT/UPDATE para admins/finance
DROP POLICY IF EXISTS "fpq_insert_policy" ON public.financial_payment_queue;
DROP POLICY IF EXISTS "fpq_update_policy" ON public.financial_payment_queue;

CREATE POLICY "fpq_insert_restricted"
ON public.financial_payment_queue
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "fpq_update_restricted"
ON public.financial_payment_queue
FOR UPDATE
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
)
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- 3. GARANTIR RLS RESTRITIVO EM TABELAS SENSÍVEIS
-- =====================================================

-- clientes_perfil_credito: garantir acesso restrito (já existe, apenas validar)
DROP POLICY IF EXISTS "clientes_perfil_credito_select" ON public.clientes_perfil_credito;
CREATE POLICY "clientes_perfil_credito_select_strict"
ON public.clientes_perfil_credito
FOR SELECT
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR
    usuario_tem_acesso_modulo(auth.uid(), 'cobranca') OR
    usuario_tem_acesso_modulo(auth.uid(), 'credito')
);

-- contas_receber: verificar/corrigir política de SELECT
DROP POLICY IF EXISTS "contas_receber_select_authorized" ON public.contas_receber;
CREATE POLICY "contas_receber_select_strict"
ON public.contas_receber
FOR SELECT
TO authenticated
USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'supervisor'::app_role) OR
    usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR
    usuario_tem_acesso_modulo(auth.uid(), 'cobranca') OR
    usuario_tem_acesso_modulo(auth.uid(), 'comercial')
);

-- 4. ADICIONAR COMENTÁRIOS DE SEGURANÇA
-- =====================================================
COMMENT ON VIEW public.clientes_safe IS 'View segura com dados de clientes mascarados. Usa security_invoker para respeitar RLS da tabela base.';
COMMENT ON VIEW public.profiles_safe IS 'View segura com perfis de usuários. Emails mascarados para não-admins. Usa security_invoker para respeitar RLS.';