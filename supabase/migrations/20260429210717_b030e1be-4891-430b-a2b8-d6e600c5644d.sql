-- Atualiza user_can_access_secao para também considerar vínculo por departamento
-- (alinhando com user_can_access_projeto, sem afrouxar regras existentes).
CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND (
    -- Admin global
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = 'admin'
    )
    -- Criador do projeto
    OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projetos p ON p.id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND p.criador_id = _user_id
    )
    -- Coordenador / gestor_produto / gerente do projeto: vê tudo do projeto
    OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projeto_membros pm ON pm.projeto_id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND pm.user_id = _user_id
        AND pm.papel IN ('coordenador', 'gestor_produto', 'gerente')
    )
    -- Membro com restrição explícita: vê apenas as seções atribuídas
    OR EXISTS (
      SELECT 1
      FROM public.projeto_membro_secoes pms
      JOIN public.projeto_membros pm ON pm.id = pms.membro_id
      WHERE pms.secao_id = _secao_id
        AND pm.user_id = _user_id
    )
    -- Membro sem restrição de seção: vê todas as seções do projeto
    OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projeto_membros pm ON pm.projeto_id = ps.projeto_id
      WHERE ps.id = _secao_id
        AND pm.user_id = _user_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.projeto_membro_secoes pms_any
          WHERE pms_any.membro_id = pm.id
        )
    )
    -- Vínculo por departamento (alinha com user_can_access_projeto)
    OR EXISTS (
      SELECT 1
      FROM public.projeto_secoes ps
      JOIN public.projeto_departamentos pd ON pd.projeto_id = ps.projeto_id
      JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE ps.id = _secao_id
        AND pr.id = _user_id
    )
  )
$function$;