CREATE OR REPLACE FUNCTION public.audit_secao_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_user uuid;
  v_projeto uuid;
  v_motivo text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT pm.user_id, pm.projeto_id INTO v_user, v_projeto
    FROM public.projeto_membros pm WHERE pm.id = NEW.membro_id;

    -- Defensivo: se o membro não existir mais, não registra
    IF v_user IS NULL THEN
      RETURN NEW;
    END IF;

    v_motivo := 'secao_liberada';
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, v_projeto, v_user, v_ator, 'ganhou_acesso',
            v_motivo, NULL, 'secao', jsonb_build_object('secao_id', NEW.secao_id));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT pm.user_id, pm.projeto_id INTO v_user, v_projeto
    FROM public.projeto_membros pm WHERE pm.id = OLD.membro_id;

    -- Quando o projeto_membros já foi deletado (CASCADE durante remoção de membro),
    -- a remoção do vínculo inteiro já é auditada por audit_membro_projeto.
    -- Não registra "secao_revogada" sem user_afetado_id (viola NOT NULL).
    IF v_user IS NULL THEN
      RETURN OLD;
    END IF;

    v_motivo := 'secao_revogada';
    INSERT INTO public.projeto_tarefa_acesso_audit
      (tarefa_id, projeto_id, user_afetado_id, ator_id, acao, motivo, papel_anterior, papel_novo, metadata)
    VALUES (NULL, v_projeto, v_user, v_ator, 'perdeu_acesso',
            v_motivo, 'secao', NULL, jsonb_build_object('secao_id', OLD.secao_id));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;