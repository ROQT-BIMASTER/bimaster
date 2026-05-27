
-- =====================================================================
-- 1. Junction table: projeto_tarefa_responsaveis
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'responsavel',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_responsaveis TO authenticated;
GRANT ALL ON public.projeto_tarefa_responsaveis TO service_role;

ALTER TABLE public.projeto_tarefa_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tarefa responsaveis"
  ON public.projeto_tarefa_responsaveis
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto_via_tarefa((SELECT auth.uid()), tarefa_id));

CREATE POLICY "Members can insert tarefa responsaveis"
  ON public.projeto_tarefa_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_projeto_via_tarefa((SELECT auth.uid()), tarefa_id));

CREATE POLICY "Members can delete tarefa responsaveis"
  ON public.projeto_tarefa_responsaveis
  FOR DELETE TO authenticated
  USING (public.user_can_access_projeto_via_tarefa((SELECT auth.uid()), tarefa_id));

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_responsaveis_user_tarefa
  ON public.projeto_tarefa_responsaveis(user_id, tarefa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_responsaveis_tarefa
  ON public.projeto_tarefa_responsaveis(tarefa_id);

-- =====================================================================
-- 2. Backfill: cada responsavel_id existente vira uma linha na junction
-- =====================================================================
INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por, created_at)
SELECT t.id, t.responsavel_id, 'responsavel', t.criador_id, COALESCE(t.created_at, now())
FROM public.projeto_tarefas t
WHERE t.responsavel_id IS NOT NULL
ON CONFLICT (tarefa_id, user_id) DO NOTHING;

-- =====================================================================
-- 3. Trigger de sincronização: mantém projeto_tarefas.responsavel_id
--    apontando para o "principal" (mais antigo da junction).
--    Quando a junction esvazia, responsavel_id volta a NULL.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.sync_tarefa_responsavel_principal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa_id uuid;
  v_principal uuid;
  v_current uuid;
BEGIN
  v_tarefa_id := COALESCE(NEW.tarefa_id, OLD.tarefa_id);

  SELECT user_id INTO v_principal
  FROM public.projeto_tarefa_responsaveis
  WHERE tarefa_id = v_tarefa_id
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  SELECT responsavel_id INTO v_current
  FROM public.projeto_tarefas
  WHERE id = v_tarefa_id;

  IF v_current IS DISTINCT FROM v_principal THEN
    UPDATE public.projeto_tarefas
       SET responsavel_id = v_principal,
           updated_at = now()
     WHERE id = v_tarefa_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tarefa_responsavel_principal
  ON public.projeto_tarefa_responsaveis;

CREATE TRIGGER trg_sync_tarefa_responsavel_principal
AFTER INSERT OR UPDATE OR DELETE ON public.projeto_tarefa_responsaveis
FOR EACH ROW
EXECUTE FUNCTION public.sync_tarefa_responsavel_principal();

-- =====================================================================
-- 4. Trigger de auditoria na junction
-- =====================================================================
CREATE OR REPLACE FUNCTION public.audit_tarefa_responsaveis_junction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_nome text;
  v_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_tarefa_id uuid := COALESCE(NEW.tarefa_id, OLD.tarefa_id);
BEGIN
  SELECT projeto_id INTO v_projeto_id
  FROM public.projeto_tarefas WHERE id = v_tarefa_id;

  IF v_projeto_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nome INTO v_nome FROM public.profiles WHERE id = v_user_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.projeto_tarefa_atividades
      (tarefa_id, projeto_id, user_id, tipo, campo, valor_novo, descricao)
    VALUES (
      v_tarefa_id, v_projeto_id, COALESCE(auth.uid(), NEW.criado_por),
      'responsavel_adicionado', 'responsaveis',
      v_user_id::text,
      'Adicionou ' || COALESCE(v_nome, 'membro') || ' como responsável'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.projeto_tarefa_atividades
      (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, descricao)
    VALUES (
      v_tarefa_id, v_projeto_id, auth.uid(),
      'responsavel_removido', 'responsaveis',
      v_user_id::text,
      'Removeu ' || COALESCE(v_nome, 'membro') || ' dos responsáveis'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tarefa_responsaveis_junction
  ON public.projeto_tarefa_responsaveis;

CREATE TRIGGER trg_audit_tarefa_responsaveis_junction
AFTER INSERT OR DELETE ON public.projeto_tarefa_responsaveis
FOR EACH ROW
EXECUTE FUNCTION public.audit_tarefa_responsaveis_junction();

-- =====================================================================
-- 5. RPC get_projeto_tarefas_v2: inclui array `responsaveis` e amplia
--    o filtro de visibilidade para considerar a junction.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_projeto_tarefas_v2(p_projeto_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_membro_id uuid;
  v_papel text;
  v_allowed_secao_ids uuid[];
  v_restrict_to_own boolean := false;
  v_total_secoes int;
  v_total_tarefas_projeto int;
  v_can_access boolean := false;
  result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.projetos p
    WHERE p.id = p_projeto_id
      AND (
        p.criador_id = v_user_id
        OR public.has_role(v_user_id, 'admin'::app_role)
        OR EXISTS (
          SELECT 1 FROM public.projeto_membros pm
          WHERE pm.projeto_id = p_projeto_id AND pm.user_id = v_user_id
        )
      )
  ) INTO v_can_access;

  IF NOT v_can_access THEN
    RAISE EXCEPTION 'Sem permissão para acessar este projeto';
  END IF;

  SELECT id, papel INTO v_membro_id, v_papel
  FROM public.projeto_membros
  WHERE projeto_id = p_projeto_id AND user_id = v_user_id
  LIMIT 1;

  IF v_membro_id IS NULL
     OR v_papel IN ('coordenador', 'gestor_produto', 'gerente')
     OR public.has_role(v_user_id, 'admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id AND criador_id = v_user_id)
  THEN
    v_restrict_to_own := false;
    v_allowed_secao_ids := NULL;
  ELSE
    v_restrict_to_own := true;
    SELECT array_agg(secao_id) INTO v_allowed_secao_ids
    FROM public.projeto_membro_secoes
    WHERE membro_id = v_membro_id;
    IF v_allowed_secao_ids IS NULL OR array_length(v_allowed_secao_ids, 1) IS NULL THEN
      v_allowed_secao_ids := NULL;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total_secoes
  FROM public.projeto_secoes WHERE projeto_id = p_projeto_id;

  SELECT COUNT(*) INTO v_total_tarefas_projeto
  FROM public.projeto_tarefas
  WHERE projeto_id = p_projeto_id AND excluida_em IS NULL;

  WITH visible_secoes AS (
    SELECT s.*
    FROM public.projeto_secoes s
    WHERE s.projeto_id = p_projeto_id
      AND (v_allowed_secao_ids IS NULL OR s.id = ANY(v_allowed_secao_ids))
    ORDER BY s.ordem
  ),
  base_tarefas AS (
    SELECT t.*
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = p_projeto_id
      AND t.excluida_em IS NULL
      AND (v_allowed_secao_ids IS NULL OR t.secao_id = ANY(v_allowed_secao_ids))
  ),
  involved_ids AS (
    SELECT id FROM base_tarefas bt
    WHERE NOT v_restrict_to_own
       OR bt.responsavel_id = v_user_id
       OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r
                  WHERE r.tarefa_id = bt.id AND r.user_id = v_user_id)
       OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c
                  WHERE c.tarefa_id = bt.id AND c.user_id = v_user_id)
  ),
  visible_ids AS (
    SELECT id FROM involved_ids
    UNION
    SELECT bt.id FROM base_tarefas bt
    WHERE bt.parent_tarefa_id IN (SELECT id FROM involved_ids)
  ),
  visible_tarefas AS (
    SELECT bt.* FROM base_tarefas bt
    WHERE bt.id IN (SELECT id FROM visible_ids)
  ),
  user_ids_set AS (
    SELECT responsavel_id AS uid FROM visible_tarefas WHERE responsavel_id IS NOT NULL
    UNION
    SELECT criador_id FROM visible_tarefas WHERE criador_id IS NOT NULL
    UNION
    SELECT c.user_id FROM public.projeto_tarefa_colaboradores c
    WHERE c.tarefa_id IN (SELECT id FROM visible_tarefas)
    UNION
    SELECT r.user_id FROM public.projeto_tarefa_responsaveis r
    WHERE r.tarefa_id IN (SELECT id FROM visible_tarefas)
  ),
  profiles_data AS (
    SELECT p.id, p.nome, p.avatar_url
    FROM public.profiles p
    WHERE p.id IN (SELECT uid FROM user_ids_set WHERE uid IS NOT NULL)
  ),
  colab_data AS (
    SELECT c.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', c.user_id,
             'nome', pd.nome,
             'avatar_url', pd.avatar_url
           )) AS colabs
    FROM public.projeto_tarefa_colaboradores c
    LEFT JOIN profiles_data pd ON pd.id = c.user_id
    WHERE c.tarefa_id IN (SELECT id FROM visible_tarefas)
    GROUP BY c.tarefa_id
  ),
  resp_data AS (
    SELECT r.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'user_id', r.user_id,
             'nome', pd.nome,
             'avatar_url', pd.avatar_url,
             'papel', r.papel
           ) ORDER BY r.created_at ASC) AS resps
    FROM public.projeto_tarefa_responsaveis r
    LEFT JOIN profiles_data pd ON pd.id = r.user_id
    WHERE r.tarefa_id IN (SELECT id FROM visible_tarefas)
    GROUP BY r.tarefa_id
  ),
  produto_ids_set AS (
    SELECT DISTINCT produto_id FROM visible_tarefas WHERE produto_id IS NOT NULL
  ),
  produto_data AS (
    SELECT fp.id, fp.foto_url, fp.tipo, fp.nome
    FROM public.fabrica_produtos fp
    WHERE fp.id IN (SELECT produto_id FROM produto_ids_set)
  ),
  link_produtos_raw AS (
    SELECT ltp.tarefa_id, ltp.produto_id
    FROM public.projeto_tarefa_produtos ltp
    WHERE ltp.tarefa_id IN (SELECT id FROM visible_tarefas)
  ),
  link_produto_info AS (
    SELECT fp.id, fp.nome, fp.foto_url, fp.codigo
    FROM public.fabrica_produtos fp
    WHERE fp.id IN (SELECT DISTINCT produto_id FROM link_produtos_raw)
  ),
  link_produtos_data AS (
    SELECT lpr.tarefa_id,
           jsonb_agg(jsonb_build_object(
             'id', lpi.id,
             'nome', lpi.nome,
             'foto_url', lpi.foto_url,
             'codigo', lpi.codigo
           )) AS produtos
    FROM link_produtos_raw lpr
    LEFT JOIN link_produto_info lpi ON lpi.id = lpr.produto_id
    WHERE lpi.id IS NOT NULL
    GROUP BY lpr.tarefa_id
  ),
  processo_data AS (
    SELECT DISTINCT ON (pp.produto_ref_id) pp.produto_ref_id, pp.numero_processo
    FROM public.product_process pp
    WHERE pp.produto_ref_id IN (SELECT produto_id FROM produto_ids_set)
      AND pp.numero_processo IS NOT NULL
    ORDER BY pp.produto_ref_id, pp.created_at DESC
  ),
  team_members_data AS (
    SELECT DISTINCT p.id, p.nome, p.avatar_url
    FROM public.projeto_membros pm
    JOIN public.profiles p ON p.id = pm.user_id
    WHERE pm.projeto_id = p_projeto_id
    ORDER BY p.nome
  )
  SELECT jsonb_build_object(
    'is_partial_view',
      v_restrict_to_own
      OR (v_allowed_secao_ids IS NOT NULL)
      OR ((SELECT COUNT(*) FROM visible_tarefas) < v_total_tarefas_projeto),
    'restrict_to_own', v_restrict_to_own,
    'allowed_secao_ids', to_jsonb(v_allowed_secao_ids),
    'total_secoes_projeto', v_total_secoes,
    'total_tarefas_projeto', v_total_tarefas_projeto,
    'visible_tarefas_count', (SELECT COUNT(*) FROM visible_tarefas),
    'secoes', COALESCE((SELECT jsonb_agg(to_jsonb(vs.*) ORDER BY vs.ordem) FROM visible_secoes vs), '[]'::jsonb),
    'tarefas', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(vt.*) ||
        jsonb_build_object(
          'responsavel', CASE WHEN vt.responsavel_id IS NOT NULL THEN
            (SELECT to_jsonb(pd) FROM profiles_data pd WHERE pd.id = vt.responsavel_id)
            ELSE NULL END,
          'responsaveis', COALESCE((SELECT resps FROM resp_data rd WHERE rd.tarefa_id = vt.id), '[]'::jsonb),
          'criador', CASE WHEN vt.criador_id IS NOT NULL THEN
            (SELECT to_jsonb(pd) FROM profiles_data pd WHERE pd.id = vt.criador_id)
            ELSE NULL END,
          'colaboradores', COALESCE((SELECT colabs FROM colab_data cd WHERE cd.tarefa_id = vt.id), '[]'::jsonb),
          'produto_foto_url', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT foto_url FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'produto_tipo', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT tipo FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'produto_nome', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT nome FROM produto_data pdt WHERE pdt.id = vt.produto_id) ELSE NULL END,
          'numero_processo', CASE WHEN vt.produto_id IS NOT NULL THEN
            (SELECT numero_processo FROM processo_data pp WHERE pp.produto_ref_id = vt.produto_id) ELSE NULL END,
          'linked_produtos', COALESCE((SELECT produtos FROM link_produtos_data lpd WHERE lpd.tarefa_id = vt.id), '[]'::jsonb)
        )
        ORDER BY vt.ordem
      )
      FROM visible_tarefas vt
    ), '[]'::jsonb),
    'team_members', COALESCE((SELECT jsonb_agg(to_jsonb(tm)) FROM team_members_data tm), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_projeto_tarefas_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_projeto_tarefas_v2(uuid) TO authenticated;

-- =====================================================================
-- 6. RPC get_minhas_tarefas_central: amplia o filtro para considerar
--    a junction de responsáveis.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
RETURNS TABLE(
  id uuid, titulo text, descricao text, status text, prioridade text,
  data_inicio_planejada date, data_prazo date, data_conclusao date,
  projeto_id uuid, projeto_nome text, projeto_cor text,
  estagio text, criador_id uuid, visibilidade text,
  secao_id uuid, secao_nome text, ordem integer,
  parent_tarefa_id uuid, responsavel_id uuid,
  responsavel_nome text, responsavel_avatar_url text,
  codigo text, produto_id uuid,
  created_at timestamptz, updated_at timestamptz, papel text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH minhas AS (
    SELECT t.*,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r
                     WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 'responsavel'
        ELSE 'colaborador'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r
                     WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 1 ELSE 2
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r
                   WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c
                   WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s
                   WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
      )
  ), dedup AS (
    SELECT DISTINCT ON (m.id) m.* FROM minhas m ORDER BY m.id, m.papel_rank
  )
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

REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central() TO authenticated;
