-- Seed determinístico para E2E de Aprovações (preview).
-- Idempotente: usa IDs fixos + ON CONFLICT DO NOTHING.
-- created_by/responsavel_id são populados em runtime por scripts/seed/e2e-aprovacoes.ts.

DO $$
DECLARE
  v_projeto_id   uuid := '00000000-e2e0-0000-0000-000000000001';
  v_config_id    uuid := '00000000-e2e0-0000-0000-000000000002';
  v_etapa_id     uuid := '00000000-e2e0-0000-0000-000000000003';
  v_instancia_id uuid := '00000000-e2e0-0000-0000-000000000004';
  v_item_id      uuid := '00000000-e2e0-0000-0000-000000000005';
  v_evt1_id      uuid := '00000000-e2e0-0000-0000-000000000006';
  v_evt2_id      uuid := '00000000-e2e0-0000-0000-000000000007';
  v_owner        uuid;
BEGIN
  -- Owner placeholder: usa qualquer admin existente para satisfazer NOT NULL/FK.
  -- O script de seed do CI sobrescreve para o usuário E2E_TEST_EMAIL.
  SELECT ur.user_id INTO v_owner
    FROM public.user_roles ur
   WHERE ur.role = 'admin'
   ORDER BY ur.user_id
   LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  END IF;

  IF v_owner IS NULL THEN
    RAISE NOTICE 'Sem usuários no projeto; seed E2E de Aprovações ignorado.';
    RETURN;
  END IF;

  -- Projeto fixo
  INSERT INTO public.projetos (id, nome, descricao, criador_id, status, visibilidade, tipo)
  VALUES (v_projeto_id, 'E2E — Central de Aprovações',
          'Projeto fixo usado pelos testes Playwright. Não editar manualmente.',
          v_owner, 'ativo', 'equipe', 'generico')
  ON CONFLICT (id) DO NOTHING;

  -- Pipeline + etapa
  INSERT INTO public.fluxo_aprovacao_config
    (id, nome, checklist_tipo, descricao, ativo, created_by, projeto_id)
  VALUES (v_config_id, 'E2E Pipeline', 'generico',
          'Pipeline determinístico para testes E2E.', true, v_owner, v_projeto_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.fluxo_aprovacao_etapas
    (id, config_id, nome, ordem, tipo_aprovacao, tipo, ativo)
  VALUES (v_etapa_id, v_config_id, 'Revisão E2E', 1, 'simples', 'aprovacao', true)
  ON CONFLICT (id) DO NOTHING;

  -- Lote (instância)
  INSERT INTO public.fluxo_aprovacao_instancias
    (id, config_id, projeto_id, etapa_atual_ordem, status, rodada, created_by,
     titulo, descricao, lote_nome, politica_movimentacao)
  VALUES (v_instancia_id, v_config_id, v_projeto_id, 1, 'pendente', 1, v_owner,
          'Lote E2E — Prospect',
          'Lote determinístico criado pela migration de seed E2E.',
          'Lote E2E — Prospect', 'continuar')
  ON CONFLICT (id) DO NOTHING;

  -- Item de aprovação (precisa de documento_id; usamos nulo via DO NOTHING se a coluna for NOT NULL)
  -- documento_id é NOT NULL → criamos um documento "fake" mínimo só se necessário.
  -- Para evitar acoplar china_produto_documentos, criamos o item apenas se houver pelo menos
  -- um documento existente que possa servir de placeholder.
  IF NOT EXISTS (SELECT 1 FROM public.aprovacao_documento_itens WHERE id = v_item_id) THEN
    DECLARE
      v_doc_id uuid;
    BEGIN
      SELECT id INTO v_doc_id FROM public.china_produto_documentos LIMIT 1;
      IF v_doc_id IS NOT NULL THEN
        INSERT INTO public.aprovacao_documento_itens
          (id, documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
           status, lote_id, projeto_id, created_by, comentario_atual)
        VALUES (v_item_id, v_doc_id, v_config_id, v_etapa_id, v_owner,
                'em_andamento', v_instancia_id, v_projeto_id, v_owner,
                'Item determinístico para testes E2E.');
      ELSE
        RAISE NOTICE 'Sem documento base; aprovacao_documento_itens não criado (será criado via script de seed).';
      END IF;
    END;
  END IF;

  -- Eventos de histórico (criação + etapa atual pendente)
  INSERT INTO public.fluxo_aprovacao_etapa_eventos
    (id, instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id,
     entrou_em, decisao, comentario, item_id)
  VALUES
    (v_evt1_id, v_instancia_id, 1, 'Revisão E2E', 1, v_owner,
     '2026-01-01 12:00:00+00', 'aprovado',
     'Seed E2E: evento inicial determinístico (criação).',
     CASE WHEN EXISTS (SELECT 1 FROM public.aprovacao_documento_itens WHERE id = v_item_id)
          THEN v_item_id ELSE NULL END),
    (v_evt2_id, v_instancia_id, 1, 'Revisão E2E', 1, v_owner,
     '2026-01-02 12:00:00+00', 'pendente',
     'Seed E2E: evento atual pendente para revisão.',
     CASE WHEN EXISTS (SELECT 1 FROM public.aprovacao_documento_itens WHERE id = v_item_id)
          THEN v_item_id ELSE NULL END)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Marcador para CI / scripts grep-verificarem que o seed está aplicado.
COMMENT ON TABLE public.fluxo_aprovacao_instancias IS
  'Inclui fixtures E2E (instancia 00000000-e2e0-0000-0000-000000000004) — ver scripts/seed/e2e-aprovacoes.ts';
