DO $$
DECLARE
  v_projeto_id uuid := 'f8f5cfd1-0bdc-45cd-8cd5-88ebe89fecef';
  v_fila_cso uuid := '10f58132-3358-478c-be66-34f84148fe7d';
  v_fila_credito uuid := '54ba916b-aede-4499-bc3c-a8f3765865a9';
  v_owner uuid := '2c721904-fc2b-4467-9d35-9aec9789edd7';
  v_rot1 uuid := 'a1a1a1a1-aaaa-4000-8000-000000000001';
  v_rot2 uuid := 'a1a1a1a1-aaaa-4000-8000-000000000002';
  v_rot3 uuid := 'a1a1a1a1-aaaa-4000-8000-000000000003';
  v_rot4 uuid := 'a1a1a1a1-aaaa-4000-8000-000000000004';
  v_proc uuid := 'b2b2b2b2-bbbb-4000-8000-000000000000';
  v_e1 uuid := 'c3c3c3c3-cccc-4000-8000-000000000001';
  v_e2 uuid := 'c3c3c3c3-cccc-4000-8000-000000000002';
  v_e3 uuid := 'c3c3c3c3-cccc-4000-8000-000000000003';
  v_e4 uuid := 'c3c3c3c3-cccc-4000-8000-000000000004';
BEGIN
  INSERT INTO public.suporte_rotinas_fixas
    (id, titulo, descricao, fila_id, responsavel_user_id, created_by, prioridade,
     sla_primeira_resposta_min, sla_resolucao_min,
     categoria, tags, gera_tarefa_projeto, projeto_id_espelho, ativo)
  VALUES
    (v_rot1, 'Priorizar redigitação pendente',
     'RETRABALHO: pedido devolvido para redigitação. Priorizar imediatamente — o SLA do pedido original já está consumido.',
     v_fila_cso, v_owner, v_owner, 'alta', 10, 30, 'redigitacao-pedidos',
     ARRAY['retrabalho','pedidos','cso'], true, v_projeto_id, true),
    (v_rot2, 'Redigitar pedido no ERP',
     'RETRABALHO: corrigir e redigitar pedido no ERP conforme motivo da devolução.',
     v_fila_cso, v_owner, v_owner, 'alta', 20, 90, 'redigitacao-pedidos',
     ARRAY['retrabalho','pedidos','cso'], true, v_projeto_id, true),
    (v_rot3, 'Aguardar liberação de crédito (redigitação)',
     'RETRABALHO: pedido redigitado aguardando análise de crédito.',
     v_fila_credito, v_owner, v_owner, 'alta', 30, 180, 'redigitacao-pedidos',
     ARRAY['retrabalho','pedidos','credito'], true, v_projeto_id, true),
    (v_rot4, 'Confirmar redigitação liberada',
     'RETRABALHO: confirmar pedido redigitado após liberação de crédito.',
     v_fila_cso, v_owner, v_owner, 'alta', 10, 30, 'redigitacao-pedidos',
     ARRAY['retrabalho','pedidos','cso'], true, v_projeto_id, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.processos_operacionais (id, nome, descricao, fila_dona_id, criador_id, versao, ativo, cor)
  VALUES (v_proc, 'Redigitação de Pedidos',
    'RETRABALHO — espelho operacional do projeto Redigitação de Pedidos. Fluxo que NÃO DEVERIA EXISTIR: representa esforço adicional gasto para corrigir pedidos já digitados. As métricas devem ser somadas às do processo original de Digitação de Pedidos e monitoradas como indicador de qualidade (quanto menor, melhor). Etapas: Pendente → Digitando → Aguardando Liberação → Liberado.',
    v_fila_cso, v_owner, 1, true, '#EF4444')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.processo_etapas (id, processo_id, rotina_fixa_id, nome_override, ordem, sla_minutos, posicao_x, posicao_y)
  VALUES
    (v_e1, v_proc, v_rot1, 'Pendente',             1, 30,  100, 200),
    (v_e2, v_proc, v_rot2, 'Digitando',            2, 90,  360, 200),
    (v_e3, v_proc, v_rot3, 'Aguardando Liberação', 3, 180, 620, 200),
    (v_e4, v_proc, v_rot4, 'Liberado',             4, 30,  880, 200)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos, rotulo)
  SELECT v_proc, de, para, 'se_concluida', 10, rot
  FROM (VALUES (v_e1, v_e2, 'Iniciar redigitação'), (v_e2, v_e3, 'Enviar para liberação'), (v_e3, v_e4, 'Confirmar')) AS v(de, para, rot)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.processo_ligacoes pl
    WHERE pl.processo_id = v_proc AND pl.de_etapa_id = v.de AND pl.para_etapa_id = v.para
  );
END $$;