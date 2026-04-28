CREATE OR REPLACE FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.projeto_secoes ps
    JOIN public.projeto_membros pm ON pm.projeto_id = ps.projeto_id
    WHERE ps.id = _secao_id
      AND pm.user_id = _user_id
      AND pm.papel = 'coordenador'
  ) OR EXISTS (
    SELECT 1
    FROM public.projeto_secoes ps
    JOIN public.projetos p ON p.id = ps.projeto_id
    WHERE ps.id = _secao_id
      AND p.criador_id = _user_id
  ) OR EXISTS (
    SELECT 1
    FROM public.projeto_membro_secoes pms
    JOIN public.projeto_membros pm ON pm.id = pms.membro_id
    WHERE pms.secao_id = _secao_id
      AND pm.user_id = _user_id
  ) OR EXISTS (
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
  ) OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = 'admin'
  )
$function$;

DROP POLICY IF EXISTS "Task owners can view own assigned tasks" ON public.projeto_tarefas;

CREATE POLICY "Task owners can view own assigned tasks"
ON public.projeto_tarefas
FOR SELECT
TO authenticated
USING (
  responsavel_id = auth.uid()
  OR criador_id = auth.uid()
);