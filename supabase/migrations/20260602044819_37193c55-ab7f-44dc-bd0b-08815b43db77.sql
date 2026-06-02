
-- =====================================================================
-- Offboarding padronizado de membro de projeto (v1)
-- Aditivo: não altera nenhuma tabela/RPC/policy existente.
-- =====================================================================

-- 1) Tabela de auditoria/lixeira de ex-membros
CREATE TABLE IF NOT EXISTS public.projeto_membros_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id_removido uuid NOT NULL,
  papel_anterior text NOT NULL,
  secoes_ids_anteriores uuid[] NOT NULL DEFAULT '{}',
  motivo text NOT NULL,
  motivo_detalhe text,
  reatribuicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  removido_por uuid NOT NULL,
  removido_em timestamptz NOT NULL DEFAULT now(),
  restaurado_em timestamptz,
  restaurado_por uuid,
  CONSTRAINT projeto_membros_audit_motivo_chk
    CHECK (motivo IN ('desligamento','mudou_squad','fim_contrato','outro'))
);

CREATE INDEX IF NOT EXISTS idx_projeto_membros_audit_projeto
  ON public.projeto_membros_audit(projeto_id, removido_em DESC);
CREATE INDEX IF NOT EXISTS idx_projeto_membros_audit_purge
  ON public.projeto_membros_audit(removido_em) WHERE restaurado_em IS NULL;

GRANT SELECT ON public.projeto_membros_audit TO authenticated;
GRANT ALL ON public.projeto_membros_audit TO service_role;

ALTER TABLE public.projeto_membros_audit ENABLE ROW LEVEL SECURITY;

-- SELECT: coordenador/gestor do projeto + admin
CREATE POLICY "Read ex-membros (project managers + admin)"
ON public.projeto_membros_audit
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projeto_membros_audit.projeto_id
      AND pm.user_id = auth.uid()
      AND pm.papel IN ('coordenador','gestor_produto')
  )
);

-- INSERT/UPDATE/DELETE não permitidos via Data API — apenas via RPC SECURITY DEFINER.

-- 2) RPC de remoção transacional
CREATE OR REPLACE FUNCTION public.rpc_remover_membro_projeto(
  _membro_id uuid,
  _reatribuicoes jsonb,
  _motivo text,
  _motivo_detalhe text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_user_removido uuid;
  v_papel_anterior text;
  v_secoes uuid[];
  v_audit_id uuid;
  v_novo_responsavel uuid;
  v_caller uuid := auth.uid();
  v_coord_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _motivo NOT IN ('desligamento','mudou_squad','fim_contrato','outro') THEN
    RAISE EXCEPTION 'invalid_motivo' USING ERRCODE = '22023';
  END IF;

  SELECT projeto_id, user_id, papel
    INTO v_projeto_id, v_user_removido, v_papel_anterior
  FROM public.projeto_membros
  WHERE id = _membro_id;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'membro_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- Autorização: admin OU gestor do próprio projeto
  IF NOT (
    has_role(v_caller, 'admin'::app_role)
    OR user_can_manage_project_members(v_caller, v_projeto_id)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Bloqueia remoção do último coordenador
  IF v_papel_anterior IN ('coordenador','gestor_produto') THEN
    SELECT count(*) INTO v_coord_count
    FROM public.projeto_membros
    WHERE projeto_id = v_projeto_id
      AND papel IN ('coordenador','gestor_produto')
      AND id <> _membro_id;
    IF v_coord_count = 0 THEN
      RAISE EXCEPTION 'ultimo_coordenador' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Snapshot das seções visíveis
  SELECT COALESCE(array_agg(secao_id), '{}'::uuid[])
    INTO v_secoes
  FROM public.projeto_membro_secoes
  WHERE membro_id = _membro_id;

  -- Reatribuições (todas opcionais; valida que o novo responsável é membro do projeto)
  -- _reatribuicoes = { "tarefas_responsavel": "<uuid>|null", "seguidores": "<uuid>|null" }
  v_novo_responsavel := NULLIF(_reatribuicoes->>'tarefas_responsavel','')::uuid;
  IF v_novo_responsavel IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projeto_membros
      WHERE projeto_id = v_projeto_id AND user_id = v_novo_responsavel
    ) THEN
      RAISE EXCEPTION 'novo_responsavel_nao_e_membro' USING ERRCODE = '22023';
    END IF;
    UPDATE public.projeto_tarefas
       SET responsavel_id = v_novo_responsavel, updated_at = now()
     WHERE projeto_id = v_projeto_id
       AND responsavel_id = v_user_removido
       AND excluida_em IS NULL;
  ELSE
    UPDATE public.projeto_tarefas
       SET responsavel_id = NULL, updated_at = now()
     WHERE projeto_id = v_projeto_id
       AND responsavel_id = v_user_removido
       AND excluida_em IS NULL;
  END IF;

  -- Seguidores: transfere ou apenas remove
  DECLARE
    v_novo_seguidor uuid := NULLIF(_reatribuicoes->>'seguidores','')::uuid;
  BEGIN
    IF v_novo_seguidor IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.projeto_membros
        WHERE projeto_id = v_projeto_id AND user_id = v_novo_seguidor
      ) THEN
        RAISE EXCEPTION 'novo_seguidor_nao_e_membro' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.projeto_tarefa_seguidores (tarefa_id, user_id)
      SELECT s.tarefa_id, v_novo_seguidor
        FROM public.projeto_tarefa_seguidores s
        JOIN public.projeto_tarefas t ON t.id = s.tarefa_id
       WHERE s.user_id = v_user_removido
         AND t.projeto_id = v_projeto_id
      ON CONFLICT DO NOTHING;
    END IF;
    DELETE FROM public.projeto_tarefa_seguidores s
      USING public.projeto_tarefas t
     WHERE s.tarefa_id = t.id
       AND s.user_id = v_user_removido
       AND t.projeto_id = v_projeto_id;
  END;

  -- Audit
  INSERT INTO public.projeto_membros_audit(
    projeto_id, user_id_removido, papel_anterior, secoes_ids_anteriores,
    motivo, motivo_detalhe, reatribuicoes, removido_por
  ) VALUES (
    v_projeto_id, v_user_removido, v_papel_anterior, v_secoes,
    _motivo, NULLIF(_motivo_detalhe, ''), COALESCE(_reatribuicoes,'{}'::jsonb), v_caller
  ) RETURNING id INTO v_audit_id;

  -- Remove vínculo (CASCADE limpa projeto_membro_secoes)
  DELETE FROM public.projeto_membros WHERE id = _membro_id;

  RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_remover_membro_projeto(uuid, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_remover_membro_projeto(uuid, jsonb, text, text) TO authenticated;

-- 3) RPC de restauração
CREATE OR REPLACE FUNCTION public.rpc_restaurar_membro_projeto(_audit_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit public.projeto_membros_audit%ROWTYPE;
  v_caller uuid := auth.uid();
  v_novo_membro_id uuid;
  v_existente_id uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_audit FROM public.projeto_membros_audit WHERE id = _audit_id;
  IF v_audit.id IS NULL THEN
    RAISE EXCEPTION 'audit_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    has_role(v_caller, 'admin'::app_role)
    OR user_can_manage_project_members(v_caller, v_audit.projeto_id)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_audit.restaurado_em IS NOT NULL THEN
    RAISE EXCEPTION 'ja_restaurado' USING ERRCODE = 'P0001';
  END IF;

  IF v_audit.removido_em < now() - INTERVAL '15 days' THEN
    RAISE EXCEPTION 'prazo_expirado' USING ERRCODE = 'P0001';
  END IF;

  -- Se já existe vínculo (membro foi readicionado manualmente), apenas marca
  SELECT id INTO v_existente_id
  FROM public.projeto_membros
  WHERE projeto_id = v_audit.projeto_id AND user_id = v_audit.user_id_removido;

  IF v_existente_id IS NULL THEN
    INSERT INTO public.projeto_membros(projeto_id, user_id, papel)
    VALUES (v_audit.projeto_id, v_audit.user_id_removido, v_audit.papel_anterior)
    RETURNING id INTO v_novo_membro_id;

    IF array_length(v_audit.secoes_ids_anteriores, 1) > 0 THEN
      INSERT INTO public.projeto_membro_secoes(membro_id, secao_id)
      SELECT v_novo_membro_id, s
        FROM unnest(v_audit.secoes_ids_anteriores) s
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    v_novo_membro_id := v_existente_id;
  END IF;

  UPDATE public.projeto_membros_audit
     SET restaurado_em = now(), restaurado_por = v_caller
   WHERE id = _audit_id;

  RETURN v_novo_membro_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_restaurar_membro_projeto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_restaurar_membro_projeto(uuid) TO authenticated;

-- 4) Feature flag (off por padrão)
INSERT INTO public.feature_flags (codigo, nome, descricao, ativo)
VALUES (
  'ff_offboarding_membros_v1',
  'Offboarding de membros do projeto',
  'Habilita o assistente de remoção com reatribuição de tarefas e aba de Ex-membros (lixeira 15 dias).',
  false
)
ON CONFLICT (codigo) DO NOTHING;
