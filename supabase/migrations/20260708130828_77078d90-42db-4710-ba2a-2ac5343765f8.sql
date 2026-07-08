CREATE OR REPLACE FUNCTION public._processo_usuario_envolvido(_processo_id uuid, _uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.processos_operacionais p
     WHERE p.id = _processo_id
       AND (
         public.has_role(_uid, 'admin'::app_role)
         OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                     WHERE fa.fila_id = p.fila_dona_id AND fa.user_id = _uid AND fa.ativo)
         OR EXISTS (
           SELECT 1 FROM public.processo_etapas pe
             JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
             JOIN public.suporte_fila_agentes fa2 ON fa2.fila_id = rf.fila_id AND fa2.user_id = _uid AND fa2.ativo
            WHERE pe.processo_id = p.id
         )
         OR EXISTS (
           SELECT 1 FROM public.processo_etapas pe2
             JOIN public.suporte_rotinas_fixas rf2 ON rf2.id = pe2.rotina_fixa_id
             JOIN public.projeto_membros pm ON pm.projeto_id = rf2.projeto_id_espelho
            WHERE pe2.processo_id = p.id
              AND pm.user_id = _uid
              AND pm.papel = 'coordenador'
         )
       )
  );
$function$;