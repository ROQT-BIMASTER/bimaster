
-- =====================================================
-- Minhas Tarefas: inline pickers (Pessoal + mover projeto)
-- =====================================================

-- 1. get_or_create_projeto_pessoal()
CREATE OR REPLACE FUNCTION public.get_or_create_projeto_pessoal()
RETURNS TABLE(projeto_id uuid, secao_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proj uuid;
  v_secao uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT id INTO v_proj
  FROM public.projetos
  WHERE criador_id = v_uid AND tipo = 'pessoal'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_proj IS NULL THEN
    INSERT INTO public.projetos (
      nome, descricao, cor, criador_id, status, visibilidade, tipo,
      regime_calendario, usa_feriados, uf_feriados, prazo_padrao_tarefa, alerta_antecipacao_dias
    )
    VALUES (
      'Pessoal', 'Espaço pessoal para tarefas sem projeto', '#94a3b8',
      v_uid, 'ativo', 'privado', 'pessoal',
      'corridos', false, 'SP', 7, 2
    )
    RETURNING id INTO v_proj;

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_proj, v_uid, 'coordenador')
    ON CONFLICT (projeto_id, user_id) DO NOTHING;

    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem, tem_briefing)
    VALUES (v_proj, 'Minhas tarefas', 0, false)
    RETURNING id INTO v_secao;
  ELSE
    SELECT id INTO v_secao
    FROM public.projeto_secoes
    WHERE projeto_id = v_proj
    ORDER BY COALESCE(ordem, 0) ASC, created_at ASC
    LIMIT 1;

    IF v_secao IS NULL THEN
      INSERT INTO public.projeto_secoes (projeto_id, nome, ordem, tem_briefing)
      VALUES (v_proj, 'Minhas tarefas', 0, false)
      RETURNING id INTO v_secao;
    END IF;
  END IF;

  RETURN QUERY SELECT v_proj, v_secao;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_projeto_pessoal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() TO authenticated;


-- 2. listar_projetos_para_vincular_tarefa()
CREATE OR REPLACE FUNCTION public.listar_projetos_para_vincular_tarefa()
RETURNS TABLE(id uuid, nome text, cor text, tipo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.nome, COALESCE(p.cor, '#6366f1') AS cor, p.tipo
  FROM public.projetos p
  WHERE auth.uid() IS NOT NULL
    AND COALESCE(p.status, 'ativo') = 'ativo'
    AND p.tipo <> 'pessoal'
    AND (
      p.criador_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.projeto_membros m
        WHERE m.projeto_id = p.id AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
      )
    )
  ORDER BY p.nome ASC;
$$;

REVOKE ALL ON FUNCTION public.listar_projetos_para_vincular_tarefa() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_projetos_para_vincular_tarefa() TO authenticated;


-- 3. mover_tarefa_para_projeto(tarefa_id, projeto_destino_id | null)
CREATE OR REPLACE FUNCTION public.mover_tarefa_para_projeto(
  p_tarefa_id uuid,
  p_projeto_id_destino uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tarefa record;
  v_projeto_dest uuid;
  v_secao_dest uuid;
  v_pessoal record;
  v_projeto_origem_nome text;
  v_projeto_destino_nome text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT t.id, t.projeto_id, t.secao_id, t.responsavel_id, t.criador_id, t.titulo
    INTO v_tarefa
  FROM public.projeto_tarefas t
  WHERE t.id = p_tarefa_id AND t.excluida_em IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'tarefa_nao_encontrada';
  END IF;

  -- Permissão: responsavel/criador ou colaborador da tarefa
  IF NOT (
    v_tarefa.responsavel_id = v_uid
    OR v_tarefa.criador_id = v_uid
    OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r
               WHERE r.tarefa_id = p_tarefa_id AND r.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c
               WHERE c.tarefa_id = p_tarefa_id AND c.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = v_uid AND ur.role = 'admin')
  ) THEN
    RAISE EXCEPTION 'sem_permissao_na_tarefa';
  END IF;

  -- Resolver destino: null => projeto pessoal do usuário
  IF p_projeto_id_destino IS NULL THEN
    SELECT * INTO v_pessoal FROM public.get_or_create_projeto_pessoal();
    v_projeto_dest := v_pessoal.projeto_id;
    v_secao_dest := v_pessoal.secao_id;
  ELSE
    -- Validar acesso ao projeto destino
    IF NOT (
      EXISTS (SELECT 1 FROM public.projetos p
              WHERE p.id = p_projeto_id_destino AND p.criador_id = v_uid)
      OR EXISTS (SELECT 1 FROM public.projeto_membros m
                 WHERE m.projeto_id = p_projeto_id_destino AND m.user_id = v_uid)
      OR EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = v_uid AND ur.role = 'admin')
    ) THEN
      RAISE EXCEPTION 'sem_acesso_ao_projeto_destino';
    END IF;

    v_projeto_dest := p_projeto_id_destino;

    SELECT id INTO v_secao_dest
    FROM public.projeto_secoes
    WHERE projeto_id = v_projeto_dest
    ORDER BY COALESCE(ordem, 0) ASC, created_at ASC
    LIMIT 1;

    IF v_secao_dest IS NULL THEN
      INSERT INTO public.projeto_secoes (projeto_id, nome, ordem, tem_briefing)
      VALUES (v_projeto_dest, 'Geral', 0, false)
      RETURNING id INTO v_secao_dest;
    END IF;
  END IF;

  IF v_tarefa.projeto_id = v_projeto_dest THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
                              'projeto_id', v_projeto_dest, 'secao_id', v_tarefa.secao_id);
  END IF;

  SELECT nome INTO v_projeto_origem_nome FROM public.projetos WHERE id = v_tarefa.projeto_id;
  SELECT nome INTO v_projeto_destino_nome FROM public.projetos WHERE id = v_projeto_dest;

  UPDATE public.projeto_tarefas
     SET projeto_id = v_projeto_dest,
         secao_id   = v_secao_dest,
         updated_at = now()
   WHERE id = p_tarefa_id;

  INSERT INTO public.projeto_tarefa_atividades(
    tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao
  )
  VALUES (
    p_tarefa_id, v_projeto_dest, v_uid, 'mudanca_projeto', 'projeto_id',
    v_tarefa.projeto_id::text, v_projeto_dest::text,
    'Tarefa movida de "' || COALESCE(v_projeto_origem_nome, '—') ||
      '" para "' || COALESCE(v_projeto_destino_nome, '—') || '"'
  );

  RETURN jsonb_build_object(
    'success', true,
    'projeto_id', v_projeto_dest,
    'secao_id', v_secao_dest
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mover_tarefa_para_projeto(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_tarefa_para_projeto(uuid, uuid) TO authenticated;
