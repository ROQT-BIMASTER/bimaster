
-- ============================================================
-- LOTE 2 — RPC + sincronização + membros + realtime
-- ============================================================

-- ------------------------------------------------------------
-- 1) Índice parcial para evitar anexos espelhados duplicados
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_projeto_tarefa_anexos_china_doc
ON public.projeto_tarefa_anexos (tarefa_id, ((metadata->>'china_documento_id')))
WHERE metadata->>'origem' = 'china_submissao'
  AND metadata->>'china_documento_id' IS NOT NULL;

-- ------------------------------------------------------------
-- 2) rpc_china_criar_projeto_espelho — versão corrigida
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_china_criar_projeto_espelho(
  p_submissao_id uuid,
  p_projeto_id uuid DEFAULT NULL::uuid,
  p_template_b2c_id uuid DEFAULT NULL::uuid,
  p_secao_nome text DEFAULT 'Documentos da Submissão'::text,
  p_projeto_nome text DEFAULT NULL::text,
  p_data_inicio date DEFAULT NULL::date,
  p_data_fim_alvo date DEFAULT NULL::date,
  p_prazo_padrao_tarefa integer DEFAULT NULL::integer,
  p_alerta_antecipacao_dias integer DEFAULT NULL::integer,
  p_regime_calendario text DEFAULT NULL::text,
  p_usa_feriados boolean DEFAULT NULL::boolean,
  p_uf_feriados text DEFAULT NULL::text,
  p_substituir boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_subm record;
  v_projeto_id uuid;
  v_secao_id uuid;
  v_checklist record;
  v_col jsonb;
  v_col_key text;
  v_col_label text;
  v_doc record;
  v_tarefa_id uuid;
  v_item jsonb;
  v_already_espelho uuid;
  v_ordem int := 0;
  v_prazo_padrao int := COALESCE(p_prazo_padrao_tarefa, 5);
  v_path text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_subm FROM public.china_produto_submissoes WHERE id = p_submissao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submissao não encontrada' USING ERRCODE = '22023';
  END IF;

  SELECT projeto_id INTO v_already_espelho
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true
  LIMIT 1;

  IF v_already_espelho IS NOT NULL THEN
    IF p_substituir THEN
      -- Limpa vínculos do projeto antigo e libera docs para reprocessamento
      DELETE FROM public.china_documento_tarefa_vinculos
      WHERE projeto_id = v_already_espelho
        AND documento_id IN (
          SELECT id FROM public.china_produto_documentos
          WHERE submissao_id = p_submissao_id
        );

      UPDATE public.china_produto_documentos
        SET projeto_tarefa_id = NULL
        WHERE submissao_id = p_submissao_id;

      UPDATE public.china_submissao_projetos
        SET is_espelho = false
        WHERE submissao_id = p_submissao_id AND is_espelho = true;
      v_already_espelho := NULL;
    ELSE
      RETURN jsonb_build_object(
        'projeto_id', v_already_espelho,
        'submissao_id', p_submissao_id,
        'created', false,
        'already_existed', true
      );
    END IF;
  END IF;

  IF p_projeto_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id FROM public.projetos WHERE id = p_projeto_id;
    IF v_projeto_id IS NULL THEN
      RAISE EXCEPTION 'projeto não encontrado' USING ERRCODE = '22023';
    END IF;

    UPDATE public.projetos
      SET
        data_inicio              = COALESCE(p_data_inicio, data_inicio),
        data_fim_alvo            = COALESCE(p_data_fim_alvo, data_fim_alvo),
        prazo_padrao_tarefa      = COALESCE(p_prazo_padrao_tarefa, prazo_padrao_tarefa),
        alerta_antecipacao_dias  = COALESCE(p_alerta_antecipacao_dias, alerta_antecipacao_dias),
        regime_calendario        = COALESCE(p_regime_calendario, regime_calendario),
        usa_feriados             = COALESCE(p_usa_feriados, usa_feriados),
        uf_feriados              = COALESCE(p_uf_feriados, uf_feriados)
      WHERE id = v_projeto_id;
  ELSE
    INSERT INTO public.projetos (
      nome, descricao, cor, icone, status, visibilidade, tipo, criador_id, origem_projeto,
      data_inicio, data_fim_alvo, prazo_padrao_tarefa, alerta_antecipacao_dias,
      regime_calendario, usa_feriados, uf_feriados
    ) VALUES (
      COALESCE(NULLIF(trim(p_projeto_nome), ''),
               'Submissão ' || COALESCE(v_subm.produto_codigo, substr(p_submissao_id::text, 1, 8))),
      'Projeto-espelho da submissão ' || COALESCE(v_subm.produto_codigo, p_submissao_id::text),
      '#E91E78',
      'Package',
      'ativo',
      'privado',
      'china_submissao',
      v_user,
      'china_submissao',
      p_data_inicio,
      p_data_fim_alvo,
      COALESCE(p_prazo_padrao_tarefa, 5),
      COALESCE(p_alerta_antecipacao_dias, 2),
      COALESCE(p_regime_calendario, 'dias_uteis'),
      COALESCE(p_usa_feriados, true),
      COALESCE(p_uf_feriados, 'BR')
    )
    RETURNING id INTO v_projeto_id;
  END IF;

  -- Membros: caller + dono da submissão (ambos os ramos)
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  VALUES (v_projeto_id, v_user, 'coordenador')
  ON CONFLICT (projeto_id, user_id) DO NOTHING;

  IF v_subm.created_by IS NOT NULL AND v_subm.created_by <> v_user THEN
    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_projeto_id, v_subm.created_by, 'coordenador')
    ON CONFLICT (projeto_id, user_id) DO NOTHING;
  END IF;

  INSERT INTO public.china_submissao_projetos (submissao_id, projeto_id, is_espelho, created_by)
  VALUES (p_submissao_id, v_projeto_id, true, v_user)
  ON CONFLICT (submissao_id, projeto_id) DO UPDATE SET is_espelho = true;

  SELECT id INTO v_secao_id
  FROM public.projeto_secoes
  WHERE projeto_id = v_projeto_id AND nome = p_secao_nome
  LIMIT 1;

  IF v_secao_id IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, p_secao_nome, 0)
    RETURNING id INTO v_secao_id;
  END IF;

  SELECT * INTO v_checklist
  FROM public.china_produto_checklist
  WHERE submissao_id = p_submissao_id
  LIMIT 1;

  IF v_checklist.id IS NOT NULL AND jsonb_typeof(v_checklist.colunas) = 'array' THEN
    FOR v_col IN SELECT * FROM jsonb_array_elements(v_checklist.colunas)
    LOOP
      v_col_key   := COALESCE(v_col->>'key', '');
      v_col_label := COALESCE(NULLIF(v_col->>'label_pt',''), NULLIF(v_col->>'label_cn',''), v_col_key, 'Item do checklist');
      v_ordem := v_ordem + 1;

      INSERT INTO public.projeto_tarefas (
        projeto_id, secao_id, titulo, descricao, status,
        criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
      ) VALUES (
        v_projeto_id, v_secao_id, v_col_label,
        'Item do checklist da submissão.',
        'pendente', v_user, 'china_submissao', 'china_checklist_item', v_ordem,
        (COALESCE(p_data_inicio, current_date) + v_prazo_padrao)::date
      )
      RETURNING id INTO v_tarefa_id;

      FOR v_doc IN
        SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento
        FROM public.china_produto_documentos
        WHERE submissao_id = p_submissao_id
          AND tipo_documento = v_col_key
          AND projeto_tarefa_id IS NULL
      LOOP
        v_path := NULLIF(trim(COALESCE(v_doc.arquivo_path, '')), '');
        IF v_path IS NOT NULL THEN
          INSERT INTO public.projeto_tarefa_anexos (
            tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
          )
          SELECT
            v_tarefa_id, v_user,
            COALESCE(v_doc.nome_arquivo, v_doc.tipo_documento, 'documento'),
            v_path,
            v_doc.tipo_documento,
            jsonb_build_object(
              'origem','china_submissao',
              'submissao_id', p_submissao_id,
              'china_documento_id', v_doc.id,
              'arquivo_url', v_doc.arquivo_url,
              'bucket', 'china-documentos'
            )
          WHERE NOT EXISTS (
            SELECT 1 FROM public.projeto_tarefa_anexos a
            WHERE a.tarefa_id = v_tarefa_id
              AND a.metadata->>'china_documento_id' = v_doc.id::text
          );

          UPDATE public.china_produto_documentos
            SET projeto_tarefa_id = v_tarefa_id
            WHERE id = v_doc.id;

          INSERT INTO public.china_documento_tarefa_vinculos
            (documento_id, tarefa_id, secao_id, projeto_id, created_by)
          VALUES (v_doc.id, v_tarefa_id, v_secao_id, v_projeto_id, v_user)
          ON CONFLICT (documento_id, tarefa_id) DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  FOR v_doc IN
    SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento, observacao, status
    FROM public.china_produto_documentos
    WHERE submissao_id = p_submissao_id
      AND projeto_tarefa_id IS NULL
  LOOP
    v_path := NULLIF(trim(COALESCE(v_doc.arquivo_path, '')), '');
    IF v_path IS NULL THEN
      CONTINUE;
    END IF;

    v_ordem := v_ordem + 1;

    INSERT INTO public.projeto_tarefas (
      projeto_id, secao_id, titulo, descricao, status,
      criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
    ) VALUES (
      v_projeto_id, v_secao_id,
      'Documento avulso — ' || COALESCE(v_doc.tipo_documento, 'sem tipo'),
      COALESCE(v_doc.observacao, ''),
      CASE v_doc.status
        WHEN 'aprovado' THEN 'concluida'
        WHEN 'rejeitado' THEN 'em_andamento'
        ELSE 'pendente'
      END,
      v_user, 'china_submissao', 'china_documento', v_ordem,
      (COALESCE(p_data_inicio, current_date) + v_prazo_padrao)::date
    )
    RETURNING id INTO v_tarefa_id;

    INSERT INTO public.projeto_tarefa_anexos (
      tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
    )
    SELECT
      v_tarefa_id, v_user,
      COALESCE(v_doc.nome_arquivo, v_doc.tipo_documento, 'documento'),
      v_path,
      v_doc.tipo_documento,
      jsonb_build_object(
        'origem','china_submissao',
        'submissao_id', p_submissao_id,
        'china_documento_id', v_doc.id,
        'arquivo_url', v_doc.arquivo_url,
        'bucket', 'china-documentos'
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefa_anexos a
      WHERE a.tarefa_id = v_tarefa_id
        AND a.metadata->>'china_documento_id' = v_doc.id::text
    );

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = v_tarefa_id
      WHERE id = v_doc.id;

    INSERT INTO public.china_documento_tarefa_vinculos
      (documento_id, tarefa_id, secao_id, projeto_id, created_by)
    VALUES (v_doc.id, v_tarefa_id, v_secao_id, v_projeto_id, v_user)
    ON CONFLICT (documento_id, tarefa_id) DO NOTHING;
  END LOOP;

  IF p_template_b2c_id IS NOT NULL THEN
    FOR v_item IN
      SELECT jsonb_array_elements(itens)
      FROM public.china_checklist_brasil_china_templates
      WHERE id = p_template_b2c_id
    LOOP
      INSERT INTO public.china_checklist_brasil_china (
        submissao_id, template_id, categoria, nome_documento, descricao,
        obrigatorio, sla_dias, status, created_by
      ) VALUES (
        p_submissao_id, p_template_b2c_id,
        COALESCE(v_item->>'categoria','Geral'),
        COALESCE(v_item->>'nome_documento','Documento'),
        v_item->>'descricao',
        COALESCE((v_item->>'obrigatorio')::boolean, true),
        NULLIF((v_item->>'sla_dias'),'')::integer,
        'pendente', v_user
      );
    END LOOP;
  END IF;

  BEGIN
    INSERT INTO public.china_timeline_eventos (
      kind, title, descricao, submissao_id, payload, actor_label
    ) VALUES (
      'projeto_espelho_criado',
      'Projeto-espelho criado',
      'Submissão vinculada ao projeto ' || v_projeto_id::text,
      p_submissao_id,
      jsonb_build_object('projeto_id', v_projeto_id, 'template_b2c_id', p_template_b2c_id, 'substituiu', p_substituir),
      'brasil'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'projeto_id', v_projeto_id,
    'submissao_id', p_submissao_id,
    'secao_id', v_secao_id,
    'created', true,
    'already_existed', false
  );
END;
$function$;

-- ------------------------------------------------------------
-- 3) rpc_china_resincronizar_espelho — nova função idempotente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_china_resincronizar_espelho(
  p_submissao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_projeto_id uuid;
  v_secao_id uuid;
  v_secao_nome text := 'Documentos da Submissão';
  v_checklist record;
  v_col jsonb;
  v_col_key text;
  v_col_label text;
  v_doc record;
  v_tarefa_id uuid;
  v_ordem int;
  v_max_ordem int;
  v_path text;
  v_tarefas_criadas int := 0;
  v_anexos_criados int := 0;
  v_vinculos_criados int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RAISE EXCEPTION 'projeto-espelho não encontrado para a submissão' USING ERRCODE = '22023';
  END IF;

  -- Permissão: admin/supervisor, módulo china, ou membro do projeto-espelho
  IF NOT (
    public.is_admin_or_supervisor(v_user)
    OR public.check_user_access(v_user, 'china')
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = v_projeto_id AND pm.user_id = v_user
    )
  ) THEN
    RAISE EXCEPTION 'sem permissão para re-sincronizar este projeto-espelho' USING ERRCODE = '42501';
  END IF;

  -- Seção padrão (cria se não existir)
  SELECT id INTO v_secao_id
  FROM public.projeto_secoes
  WHERE projeto_id = v_projeto_id AND nome = v_secao_nome
  LIMIT 1;

  IF v_secao_id IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, v_secao_nome, 0)
    RETURNING id INTO v_secao_id;
  END IF;

  SELECT COALESCE(MAX(ordem), 0) INTO v_max_ordem
  FROM public.projeto_tarefas
  WHERE projeto_id = v_projeto_id AND secao_id = v_secao_id;

  v_ordem := v_max_ordem;

  -- Colunas do checklist → garante tarefa por coluna
  SELECT * INTO v_checklist
  FROM public.china_produto_checklist
  WHERE submissao_id = p_submissao_id
  LIMIT 1;

  IF v_checklist.id IS NOT NULL AND jsonb_typeof(v_checklist.colunas) = 'array' THEN
    FOR v_col IN SELECT * FROM jsonb_array_elements(v_checklist.colunas)
    LOOP
      v_col_key   := COALESCE(v_col->>'key', '');
      v_col_label := COALESCE(NULLIF(v_col->>'label_pt',''), NULLIF(v_col->>'label_cn',''), v_col_key, 'Item do checklist');

      SELECT id INTO v_tarefa_id
      FROM public.projeto_tarefas
      WHERE projeto_id = v_projeto_id
        AND secao_id = v_secao_id
        AND tipo_tarefa = 'china_checklist_item'
        AND titulo = v_col_label
      LIMIT 1;

      IF v_tarefa_id IS NULL THEN
        v_ordem := v_ordem + 1;
        INSERT INTO public.projeto_tarefas (
          projeto_id, secao_id, titulo, descricao, status,
          criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
        ) VALUES (
          v_projeto_id, v_secao_id, v_col_label,
          'Item do checklist da submissão.',
          'pendente', v_user, 'china_submissao', 'china_checklist_item', v_ordem,
          (current_date + 5)::date
        )
        RETURNING id INTO v_tarefa_id;
        v_tarefas_criadas := v_tarefas_criadas + 1;
      END IF;

      -- Anexa docs órfãos cujo tipo bate com a coluna
      FOR v_doc IN
        SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento
        FROM public.china_produto_documentos
        WHERE submissao_id = p_submissao_id
          AND tipo_documento = v_col_key
          AND projeto_tarefa_id IS NULL
      LOOP
        v_path := NULLIF(trim(COALESCE(v_doc.arquivo_path, '')), '');
        IF v_path IS NULL THEN CONTINUE; END IF;

        WITH ins AS (
          INSERT INTO public.projeto_tarefa_anexos (
            tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
          )
          SELECT v_tarefa_id, v_user,
                 COALESCE(v_doc.nome_arquivo, v_doc.tipo_documento, 'documento'),
                 v_path, v_doc.tipo_documento,
                 jsonb_build_object(
                   'origem','china_submissao',
                   'submissao_id', p_submissao_id,
                   'china_documento_id', v_doc.id,
                   'arquivo_url', v_doc.arquivo_url,
                   'bucket', 'china-documentos'
                 )
          WHERE NOT EXISTS (
            SELECT 1 FROM public.projeto_tarefa_anexos a
            WHERE a.tarefa_id = v_tarefa_id
              AND a.metadata->>'china_documento_id' = v_doc.id::text
          )
          RETURNING 1
        )
        SELECT count(*) FROM ins INTO STRICT v_anexos_criados;

        v_anexos_criados := v_anexos_criados; -- noop (mantém contador local válido)

        UPDATE public.china_produto_documentos
          SET projeto_tarefa_id = v_tarefa_id
          WHERE id = v_doc.id;

        WITH inv AS (
          INSERT INTO public.china_documento_tarefa_vinculos
            (documento_id, tarefa_id, secao_id, projeto_id, created_by)
          VALUES (v_doc.id, v_tarefa_id, v_secao_id, v_projeto_id, v_user)
          ON CONFLICT (documento_id, tarefa_id) DO NOTHING
          RETURNING 1
        )
        SELECT v_vinculos_criados + count(*) FROM inv INTO v_vinculos_criados;
      END LOOP;
    END LOOP;
  END IF;

  -- Documentos avulsos (sem coluna de checklist correspondente)
  FOR v_doc IN
    SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento, observacao, status
    FROM public.china_produto_documentos
    WHERE submissao_id = p_submissao_id
      AND projeto_tarefa_id IS NULL
  LOOP
    v_path := NULLIF(trim(COALESCE(v_doc.arquivo_path, '')), '');
    IF v_path IS NULL THEN CONTINUE; END IF;

    v_ordem := v_ordem + 1;

    INSERT INTO public.projeto_tarefas (
      projeto_id, secao_id, titulo, descricao, status,
      criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
    ) VALUES (
      v_projeto_id, v_secao_id,
      'Documento avulso — ' || COALESCE(v_doc.tipo_documento, 'sem tipo'),
      COALESCE(v_doc.observacao, ''),
      CASE v_doc.status
        WHEN 'aprovado' THEN 'concluida'
        WHEN 'rejeitado' THEN 'em_andamento'
        ELSE 'pendente'
      END,
      v_user, 'china_submissao', 'china_documento', v_ordem,
      (current_date + 5)::date
    )
    RETURNING id INTO v_tarefa_id;
    v_tarefas_criadas := v_tarefas_criadas + 1;

    INSERT INTO public.projeto_tarefa_anexos (
      tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
    )
    SELECT v_tarefa_id, v_user,
           COALESCE(v_doc.nome_arquivo, v_doc.tipo_documento, 'documento'),
           v_path, v_doc.tipo_documento,
           jsonb_build_object(
             'origem','china_submissao',
             'submissao_id', p_submissao_id,
             'china_documento_id', v_doc.id,
             'arquivo_url', v_doc.arquivo_url,
             'bucket', 'china-documentos'
           )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefa_anexos a
      WHERE a.tarefa_id = v_tarefa_id
        AND a.metadata->>'china_documento_id' = v_doc.id::text
    );
    v_anexos_criados := v_anexos_criados + 1;

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = v_tarefa_id
      WHERE id = v_doc.id;

    INSERT INTO public.china_documento_tarefa_vinculos
      (documento_id, tarefa_id, secao_id, projeto_id, created_by)
    VALUES (v_doc.id, v_tarefa_id, v_secao_id, v_projeto_id, v_user)
    ON CONFLICT (documento_id, tarefa_id) DO NOTHING;
    v_vinculos_criados := v_vinculos_criados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'projeto_id', v_projeto_id,
    'submissao_id', p_submissao_id,
    'tarefas_criadas', v_tarefas_criadas,
    'anexos_criados', v_anexos_criados,
    'vinculos_criados', v_vinculos_criados
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_china_resincronizar_espelho(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_china_resincronizar_espelho(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 4) Backfill de membros + limpeza de anexos quebrados
-- ------------------------------------------------------------

-- Caller original (criador do projeto) já está como membro nos espelhos novos.
-- Adicionar o dono da submissão como membro coordenador.
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT sp.projeto_id, s.created_by, 'coordenador'
FROM public.china_submissao_projetos sp
JOIN public.china_produto_submissoes s ON s.id = sp.submissao_id
WHERE sp.is_espelho = true AND s.created_by IS NOT NULL
ON CONFLICT (projeto_id, user_id) DO NOTHING;

-- Adicionar também o criador do vínculo espelho (quem rodou a RPC original).
INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT sp.projeto_id, sp.created_by, 'coordenador'
FROM public.china_submissao_projetos sp
WHERE sp.is_espelho = true AND sp.created_by IS NOT NULL
ON CONFLICT (projeto_id, user_id) DO NOTHING;

-- ALLOW-DESTRUCTIVE: limpar anexos espelhados quebrados (path vazio / URL assinada) gerados pela RPC anterior (BIM-china-resync)
DELETE FROM public.projeto_tarefa_anexos
WHERE metadata->>'origem' = 'china_submissao'
  AND (
    storage_path IS NULL
    OR storage_path = ''
    OR storage_path LIKE 'http%'
  );

-- ------------------------------------------------------------
-- 5) Realtime
-- ------------------------------------------------------------
ALTER TABLE public.projeto_tarefa_anexos REPLICA IDENTITY FULL;
ALTER TABLE public.china_documento_tarefa_vinculos REPLICA IDENTITY FULL;
ALTER TABLE public.projeto_tarefa_comentarios REPLICA IDENTITY FULL;
ALTER TABLE public.projeto_tarefa_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_tarefa_anexos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_tarefa_comentarios;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_tarefa_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.china_documento_tarefa_vinculos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
