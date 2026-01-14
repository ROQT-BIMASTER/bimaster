
-- Remover políticas inseguras que permitem acesso público
DROP POLICY IF EXISTS "Allow read access for contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Allow sync inserts for contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Allow sync updates for contas_receber" ON public.contas_receber;

-- Manter as políticas seguras existentes e adicionar política para serviço de sync via service_role
-- As políticas existentes contas_receber_select, contas_receber_modify_restricted e contas_receber_all 
-- já garantem acesso apenas para admins, supervisores e usuários do departamento financeiro

-- Criar política para permitir operações de sincronização via service_role (usado pelas edge functions)
-- O service_role já bypassa RLS automaticamente, então não precisa de política específica
