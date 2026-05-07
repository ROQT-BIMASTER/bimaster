
-- 0: Corrigir trigger quebrado (criado_por -> criador_id)
CREATE OR REPLACE FUNCTION public.validate_tarefa_colaborador_membro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id uuid;
  v_is_membro boolean;
  v_is_criador boolean;
BEGIN
  SELECT projeto_id INTO v_projeto_id FROM public.projeto_tarefas WHERE id = NEW.tarefa_id;
  IF v_projeto_id IS NULL THEN RETURN NEW; END IF;

  SELECT EXISTS(SELECT 1 FROM public.projeto_membros WHERE projeto_id = v_projeto_id AND user_id = NEW.user_id) INTO v_is_membro;
  SELECT EXISTS(SELECT 1 FROM public.projetos WHERE id = v_projeto_id AND criador_id = NEW.user_id) INTO v_is_criador;

  IF NOT v_is_membro AND NOT v_is_criador THEN
    RAISE EXCEPTION 'Apenas membros cadastrados no projeto podem ser adicionados como seguidores da tarefa.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

-- B: Função get_minhas_tarefas_central com seguidores
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
 RETURNS TABLE(id uuid, titulo text, descricao text, status text, prioridade text, data_inicio_planejada date, data_prazo date, data_conclusao date, projeto_id uuid, projeto_nome text, projeto_cor text, estagio text, criador_id uuid, visibilidade text, secao_id uuid, secao_nome text, ordem integer, parent_tarefa_id uuid, responsavel_id uuid, responsavel_nome text, responsavel_avatar_url text, codigo text, produto_id uuid, created_at timestamp with time zone, updated_at timestamp with time zone, papel text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT t.*,
      CASE WHEN t.responsavel_id = auth.uid() THEN 'responsavel' ELSE 'colaborador' END AS papel_calc,
      CASE WHEN t.responsavel_id = auth.uid() THEN 1 ELSE 2 END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
      )
  ), dedup AS (SELECT DISTINCT ON (m.id) m.* FROM minhas m ORDER BY m.id, m.papel_rank)
  SELECT d.id, d.titulo, d.descricao, d.status, d.prioridade,
    d.data_inicio_planejada, d.data_prazo, d.data_conclusao,
    d.projeto_id, COALESCE(p.nome, 'Sem projeto'), COALESCE(p.cor, '#6366f1'),
    d.estagio, d.criador_id, d.visibilidade, d.secao_id, s.nome,
    COALESCE(d.ordem, 0), d.parent_tarefa_id, d.responsavel_id,
    pr.nome, pr.avatar_url, d.codigo, d.produto_id, d.created_at, d.updated_at, d.papel_calc
  FROM dedup d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = d.secao_id
  LEFT JOIN public.profiles pr ON pr.id = d.responsavel_id
  ORDER BY d.data_prazo ASC NULLS LAST, d.created_at ASC;
$function$;

-- A: Unificar perfis Mirella
DO $$
DECLARE
  perfil_login uuid := '8f631f75-7c3b-4926-ae27-2201e5a8c9b9';
  perfil_dup   uuid := '3eb7a0ba-985f-4006-ad43-af7ed1bb56af';
BEGIN
  UPDATE public.asana_sync_mappings SET local_id = perfil_login WHERE entity_type='user' AND local_id = perfil_dup;
  -- Garantir membership do perfil_login antes (para o trigger validador passar)
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    SELECT projeto_id, perfil_login, papel FROM public.projeto_membros WHERE user_id = perfil_dup
    ON CONFLICT (projeto_id, user_id) DO NOTHING;
  UPDATE public.projeto_tarefa_colaboradores SET user_id = perfil_login
    WHERE user_id = perfil_dup AND NOT EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c2 WHERE c2.tarefa_id = projeto_tarefa_colaboradores.tarefa_id AND c2.user_id = perfil_login);
  UPDATE public.projeto_tarefa_seguidores SET user_id = perfil_login
    WHERE user_id = perfil_dup AND NOT EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s2 WHERE s2.tarefa_id = projeto_tarefa_seguidores.tarefa_id AND s2.user_id = perfil_login);
  UPDATE public.projeto_tarefas SET responsavel_id = perfil_login WHERE responsavel_id = perfil_dup;
  UPDATE public.projeto_tarefas SET criador_id = perfil_login WHERE criador_id = perfil_dup;
  UPDATE public.profiles SET status='inativo', email = email || '.duplicado' WHERE id = perfil_dup;
END $$;

-- E: Mapear gids órfãos por e-mail
INSERT INTO public.asana_sync_mappings (asana_gid, entity_type, local_id, workspace_gid)
SELECT v.gid, 'user', v.profile_id::uuid,
  (SELECT workspace_gid FROM public.asana_sync_mappings WHERE entity_type='user' AND workspace_gid IS NOT NULL LIMIT 1)
FROM (VALUES
  ('1209310707407271','473d2501-ba2f-4288-b873-0725e2e90996'),
  ('1210968394112000','ea750e42-5e8c-4c19-b937-ffc4d3ee44eb'),
  ('1209093375309570','7eb17733-d824-4758-8ddf-7b9606ef4991'),
  ('1209093380713924','23d470c6-7a46-4643-9a45-ef082fe808e1'),
  ('1210968538092787','2f3df7bd-7db9-404a-8093-d80168ceab70'),
  ('1210456105908915','bf225976-d2ce-43cd-94d1-c7ab8691935e')
) v(gid, profile_id)
WHERE NOT EXISTS (SELECT 1 FROM public.asana_sync_mappings m WHERE m.entity_type='user' AND m.asana_gid = v.gid);

-- Garantir membership ANTES de inserir seguidores (trigger valida)
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT DISTINCT t.projeto_id, m.local_id, 'membro'
FROM public.projeto_tarefas t
CROSS JOIN LATERAL jsonb_array_elements(t.asana_json_raw->'followers') f
JOIN public.asana_sync_mappings m ON m.entity_type='user' AND m.asana_gid = f->>'gid'
WHERE t.excluida_em IS NULL AND t.asana_gid IS NOT NULL
  AND t.projeto_id IS NOT NULL
  AND jsonb_typeof(t.asana_json_raw->'followers') = 'array'
ON CONFLICT (projeto_id, user_id) DO NOTHING;

-- Também garantir membership para responsáveis
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT DISTINCT t.projeto_id, t.responsavel_id, 'membro'
FROM public.projeto_tarefas t
WHERE t.excluida_em IS NULL AND t.projeto_id IS NOT NULL AND t.responsavel_id IS NOT NULL
ON CONFLICT (projeto_id, user_id) DO NOTHING;

-- D: Backfill seguidores e colaboradores
INSERT INTO public.projeto_tarefa_seguidores (tarefa_id, user_id, asana_gid)
SELECT t.id, m.local_id, f->>'gid'
FROM public.projeto_tarefas t
CROSS JOIN LATERAL jsonb_array_elements(t.asana_json_raw->'followers') f
JOIN public.asana_sync_mappings m ON m.entity_type='user' AND m.asana_gid = f->>'gid'
WHERE t.excluida_em IS NULL AND t.asana_gid IS NOT NULL
  AND jsonb_typeof(t.asana_json_raw->'followers') = 'array'
ON CONFLICT (tarefa_id, user_id) DO NOTHING;

INSERT INTO public.projeto_tarefa_colaboradores (tarefa_id, user_id)
SELECT t.id, m.local_id
FROM public.projeto_tarefas t
CROSS JOIN LATERAL jsonb_array_elements(t.asana_json_raw->'followers') f
JOIN public.asana_sync_mappings m ON m.entity_type='user' AND m.asana_gid = f->>'gid'
WHERE t.excluida_em IS NULL AND t.asana_gid IS NOT NULL
  AND jsonb_typeof(t.asana_json_raw->'followers') = 'array'
ON CONFLICT (tarefa_id, user_id) DO NOTHING;
