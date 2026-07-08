DO $migration$
DECLARE
  v_projeto_id       uuid := '2aa8a375-42ff-4ca9-bee3-686df15263de';
  v_fila_adm_cso     uuid := '10f58132-3358-478c-be66-34f84148fe7d';
  v_fila_compras     uuid := 'c494049a-9aca-4885-aa05-e91d7be1547f';
  v_fila_credito     uuid := '54ba916b-aede-4499-bc3c-a8f3765865a9';
  v_owner            uuid := '2c721904-fc2b-4467-9d35-9aec9789edd7'; -- mesmo dono das rotinas de Digitação de Pedidos

  v_rot_1 uuid; v_rot_2 uuid; v_rot_3 uuid; v_rot_4 uuid; v_rot_5 uuid;
  v_processo_id uuid;
  v_etapa_1 uuid; v_etapa_2 uuid; v_etapa_3 uuid; v_etapa_4 uuid; v_etapa_5 uuid;
BEGIN
  -- ROTINAS FIXAS ------------------------------------------------------------
  SELECT id INTO v_rot_1 FROM public.suporte_rotinas_fixas
   WHERE categoria='pedidos-distribuidor' AND titulo='Atribuir pedido distribuidor' LIMIT 1;
  IF v_rot_1 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas
      (titulo, descricao, fila_id, responsavel_user_id, prioridade,
       sla_primeira_resposta_min, sla_resolucao_min,
       checklist, categoria, tags,
       gera_tarefa_projeto, projeto_id_espelho, ativo, created_by)
    VALUES
      ('Atribuir pedido distribuidor',
       'Atribuir novo pedido de distribuidor a um digitador do Administrativo CSO.',
       v_fila_adm_cso, v_owner, 'media', 15, 60,
       '[]'::jsonb, 'pedidos-distribuidor', ARRAY['pedidos','distribuidor','cso'],
       true, v_projeto_id, true, v_owner)
    RETURNING id INTO v_rot_1;
  END IF;

  SELECT id INTO v_rot_2 FROM public.suporte_rotinas_fixas
   WHERE categoria='pedidos-distribuidor' AND titulo='Aprovação de compras' LIMIT 1;
  IF v_rot_2 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas
      (titulo, descricao, fila_id, responsavel_user_id, prioridade,
       sla_primeira_resposta_min, sla_resolucao_min,
       checklist, categoria, tags,
       gera_tarefa_projeto, projeto_id_espelho, ativo, created_by)
    VALUES
      ('Aprovação de compras',
       'Análise e aprovação do pedido do distribuidor pelo setor de Compras antes da digitação.',
       v_fila_compras, v_owner, 'alta', 30, 240,
       '[]'::jsonb, 'pedidos-distribuidor', ARRAY['pedidos','distribuidor','compras','aprovacao'],
       true, v_projeto_id, true, v_owner)
    RETURNING id INTO v_rot_2;
  END IF;

  SELECT id INTO v_rot_3 FROM public.suporte_rotinas_fixas
   WHERE categoria='pedidos-distribuidor' AND titulo='Digitar pedido distribuidor no ERP' LIMIT 1;
  IF v_rot_3 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas
      (titulo, descricao, fila_id, responsavel_user_id, prioridade,
       sla_primeira_resposta_min, sla_resolucao_min,
       checklist, categoria, tags,
       gera_tarefa_projeto, projeto_id_espelho, ativo, created_by)
    VALUES
      ('Digitar pedido distribuidor no ERP',
       'Digitação do pedido do distribuidor no ERP após aprovação de compras.',
       v_fila_adm_cso, v_owner, 'alta', 30, 120,
       '[]'::jsonb, 'pedidos-distribuidor', ARRAY['pedidos','distribuidor','erp','digitacao'],
       true, v_projeto_id, true, v_owner)
    RETURNING id INTO v_rot_3;
  END IF;

  SELECT id INTO v_rot_4 FROM public.suporte_rotinas_fixas
   WHERE categoria='pedidos-distribuidor' AND titulo='Analisar e liberar crédito' LIMIT 1;
  IF v_rot_4 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas
      (titulo, descricao, fila_id, responsavel_user_id, prioridade,
       sla_primeira_resposta_min, sla_resolucao_min,
       checklist, categoria, tags,
       gera_tarefa_projeto, projeto_id_espelho, ativo, created_by)
    VALUES
      ('Analisar e liberar crédito',
       'Análise de crédito do distribuidor e liberação do pedido para faturamento.',
       v_fila_credito, v_owner, 'alta', 60, 240,
       '[]'::jsonb, 'pedidos-distribuidor', ARRAY['pedidos','distribuidor','credito','liberacao'],
       true, v_projeto_id, true, v_owner)
    RETURNING id INTO v_rot_4;
  END IF;

  SELECT id INTO v_rot_5 FROM public.suporte_rotinas_fixas
   WHERE categoria='pedidos-distribuidor' AND titulo='Confirmar pedido distribuidor liberado' LIMIT 1;
  IF v_rot_5 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas
      (titulo, descricao, fila_id, responsavel_user_id, prioridade,
       sla_primeira_resposta_min, sla_resolucao_min,
       checklist, categoria, tags,
       gera_tarefa_projeto, projeto_id_espelho, ativo, created_by)
    VALUES
      ('Confirmar pedido distribuidor liberado',
       'Confirmação final do pedido do distribuidor após liberação de crédito.',
       v_fila_adm_cso, v_owner, 'media', 15, 30,
       '[]'::jsonb, 'pedidos-distribuidor', ARRAY['pedidos','distribuidor','confirmacao'],
       true, v_projeto_id, true, v_owner)
    RETURNING id INTO v_rot_5;
  END IF;

  -- PROCESSO -----------------------------------------------------------------
  SELECT id INTO v_processo_id FROM public.processos_operacionais
   WHERE nome='Pedidos Distribuidor' LIMIT 1;
  IF v_processo_id IS NULL THEN
    INSERT INTO public.processos_operacionais
      (nome, descricao, fila_dona_id, versao, ativo, cor, criador_id)
    VALUES
      ('Pedidos Distribuidor',
       'Espelho operacional do projeto Pedidos Distribuidor — Atribuir → Aprovação Compras → Digitar → Liberar Crédito → Confirmar',
       v_fila_adm_cso, 1, true, '#0EA5E9', v_owner)
    RETURNING id INTO v_processo_id;
  END IF;

  -- ETAPAS -------------------------------------------------------------------
  SELECT id INTO v_etapa_1 FROM public.processo_etapas
   WHERE processo_id=v_processo_id AND rotina_fixa_id=v_rot_1 LIMIT 1;
  IF v_etapa_1 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y)
    VALUES (v_processo_id, v_rot_1, 1, 60, 120, 100) RETURNING id INTO v_etapa_1;
  END IF;

  SELECT id INTO v_etapa_2 FROM public.processo_etapas
   WHERE processo_id=v_processo_id AND rotina_fixa_id=v_rot_2 LIMIT 1;
  IF v_etapa_2 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y)
    VALUES (v_processo_id, v_rot_2, 2, 240, 400, 100) RETURNING id INTO v_etapa_2;
  END IF;

  SELECT id INTO v_etapa_3 FROM public.processo_etapas
   WHERE processo_id=v_processo_id AND rotina_fixa_id=v_rot_3 LIMIT 1;
  IF v_etapa_3 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y)
    VALUES (v_processo_id, v_rot_3, 3, 120, 680, 100) RETURNING id INTO v_etapa_3;
  END IF;

  SELECT id INTO v_etapa_4 FROM public.processo_etapas
   WHERE processo_id=v_processo_id AND rotina_fixa_id=v_rot_4 LIMIT 1;
  IF v_etapa_4 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y)
    VALUES (v_processo_id, v_rot_4, 4, 240, 960, 220) RETURNING id INTO v_etapa_4;
  END IF;

  SELECT id INTO v_etapa_5 FROM public.processo_etapas
   WHERE processo_id=v_processo_id AND rotina_fixa_id=v_rot_5 LIMIT 1;
  IF v_etapa_5 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y)
    VALUES (v_processo_id, v_rot_5, 5, 30, 1240, 100) RETURNING id INTO v_etapa_5;
  END IF;

  -- LIGAÇÕES -----------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_etapa_1 AND para_etapa_id=v_etapa_2) THEN
    INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
    VALUES (v_processo_id, v_etapa_1, v_etapa_2, 'se_concluida', 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_etapa_2 AND para_etapa_id=v_etapa_3) THEN
    INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
    VALUES (v_processo_id, v_etapa_2, v_etapa_3, 'se_concluida', 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_etapa_3 AND para_etapa_id=v_etapa_4) THEN
    INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
    VALUES (v_processo_id, v_etapa_3, v_etapa_4, 'se_concluida', 15);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_etapa_4 AND para_etapa_id=v_etapa_5) THEN
    INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
    VALUES (v_processo_id, v_etapa_4, v_etapa_5, 'se_concluida', 15);
  END IF;
END
$migration$;