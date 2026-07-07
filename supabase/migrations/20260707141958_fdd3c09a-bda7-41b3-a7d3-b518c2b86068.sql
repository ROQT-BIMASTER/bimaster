
INSERT INTO public.suporte_filas (nome, slug, descricao, cor, icone, ativo, aceita_chamados, ordem)
VALUES ('Liberação de Crédito','liberacao-credito','Análise e liberação de crédito para pedidos digitados','#F59E0B','ShieldCheck',true,true,50)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  v_fila_adm uuid;
  v_fila_cred uuid;
  v_processo uuid;
  v_rot1 uuid; v_rot2 uuid; v_rot3 uuid; v_rot4 uuid;
  v_et1 uuid; v_et2 uuid; v_et3 uuid; v_et4 uuid;
  v_projeto_espelho uuid := '76265224-481a-45e1-8725-3f97889ba2cd';
  v_resp uuid := '2c721904-fc2b-4467-9d35-9aec9789edd7';
BEGIN
  SELECT id INTO v_fila_adm  FROM public.suporte_filas WHERE slug='administrativo-cso';
  SELECT id INTO v_fila_cred FROM public.suporte_filas WHERE slug='liberacao-credito';

  SELECT id INTO v_processo FROM public.processos_operacionais WHERE nome='Digitação de Pedidos' LIMIT 1;
  IF v_processo IS NULL THEN
    INSERT INTO public.processos_operacionais (nome, descricao, fila_dona_id, cor, ativo, versao, criador_id)
    VALUES ('Digitação de Pedidos','Espelho operacional do projeto CSO (Talita) — Atribuir → Digitar → Liberar crédito → Confirmar', v_fila_adm, '#6366F1', true, 1, v_resp)
    RETURNING id INTO v_processo;
  END IF;

  SELECT id INTO v_rot1 FROM public.suporte_rotinas_fixas WHERE titulo='Atribuir pedido para digitação' AND fila_id=v_fila_adm LIMIT 1;
  IF v_rot1 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas (titulo, descricao, fila_id, responsavel_user_id, created_by, prioridade, sla_primeira_resposta_min, sla_resolucao_min, categoria, ativo, gera_tarefa_projeto, projeto_id_espelho)
    VALUES ('Atribuir pedido para digitação','Recebimento e triagem de pedidos que entram para digitação',v_fila_adm,v_resp,v_resp,'media',15,60,'digitacao-pedidos',true,true,v_projeto_espelho)
    RETURNING id INTO v_rot1;
  END IF;

  SELECT id INTO v_rot2 FROM public.suporte_rotinas_fixas WHERE titulo='Digitar pedido no ERP' AND fila_id=v_fila_adm LIMIT 1;
  IF v_rot2 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas (titulo, descricao, fila_id, responsavel_user_id, created_by, prioridade, sla_primeira_resposta_min, sla_resolucao_min, categoria, ativo, gera_tarefa_projeto, projeto_id_espelho)
    VALUES ('Digitar pedido no ERP','Digitação efetiva do pedido no sistema com conferência de itens e condições',v_fila_adm,v_resp,v_resp,'alta',30,120,'digitacao-pedidos',true,true,v_projeto_espelho)
    RETURNING id INTO v_rot2;
  END IF;

  SELECT id INTO v_rot3 FROM public.suporte_rotinas_fixas WHERE titulo='Analisar e liberar crédito' AND fila_id=v_fila_cred LIMIT 1;
  IF v_rot3 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas (titulo, descricao, fila_id, responsavel_user_id, created_by, prioridade, sla_primeira_resposta_min, sla_resolucao_min, categoria, ativo, gera_tarefa_projeto, projeto_id_espelho)
    VALUES ('Analisar e liberar crédito','Análise de crédito do cliente e liberação (ou reprovação) do pedido digitado',v_fila_cred,v_resp,v_resp,'alta',60,240,'digitacao-pedidos',true,true,v_projeto_espelho)
    RETURNING id INTO v_rot3;
  END IF;

  SELECT id INTO v_rot4 FROM public.suporte_rotinas_fixas WHERE titulo='Confirmar pedido liberado' AND fila_id=v_fila_adm LIMIT 1;
  IF v_rot4 IS NULL THEN
    INSERT INTO public.suporte_rotinas_fixas (titulo, descricao, fila_id, responsavel_user_id, created_by, prioridade, sla_primeira_resposta_min, sla_resolucao_min, categoria, ativo, gera_tarefa_projeto, projeto_id_espelho)
    VALUES ('Confirmar pedido liberado','Confirmação final do pedido liberado e comunicação com logística/cliente',v_fila_adm,v_resp,v_resp,'media',15,30,'digitacao-pedidos',true,true,v_projeto_espelho)
    RETURNING id INTO v_rot4;
  END IF;

  SELECT id INTO v_et1 FROM public.processo_etapas WHERE processo_id=v_processo AND rotina_fixa_id=v_rot1 LIMIT 1;
  IF v_et1 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y, parecer_administrativo)
    VALUES (v_processo, v_rot1, 1, 60, 0, 0, 'Fase inicial: pedidos recém-recebidos são atribuídos a um digitador da equipe CSO.')
    RETURNING id INTO v_et1;
  END IF;

  SELECT id INTO v_et2 FROM public.processo_etapas WHERE processo_id=v_processo AND rotina_fixa_id=v_rot2 LIMIT 1;
  IF v_et2 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y, parecer_administrativo)
    VALUES (v_processo, v_rot2, 2, 120, 320, 0, 'Digitação efetiva no ERP. Conferência obrigatória de itens, preços e condições comerciais antes de encaminhar para crédito.')
    RETURNING id INTO v_et2;
  END IF;

  SELECT id INTO v_et3 FROM public.processo_etapas WHERE processo_id=v_processo AND rotina_fixa_id=v_rot3 LIMIT 1;
  IF v_et3 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y, parecer_administrativo)
    VALUES (v_processo, v_rot3, 3, 240, 640, 200, 'Handoff para equipe de crédito (Inara). Análise de limite, inadimplência e liberação. SLA crítico: se estourar, escala para o gerente administrativo.')
    RETURNING id INTO v_et3;
  END IF;

  SELECT id INTO v_et4 FROM public.processo_etapas WHERE processo_id=v_processo AND rotina_fixa_id=v_rot4 LIMIT 1;
  IF v_et4 IS NULL THEN
    INSERT INTO public.processo_etapas (processo_id, rotina_fixa_id, ordem, sla_minutos, posicao_x, posicao_y, parecer_administrativo)
    VALUES (v_processo, v_rot4, 4, 30, 960, 0, 'Confirmação final: pedido liberado retorna para o CSO que valida e comunica logística/cliente.')
    RETURNING id INTO v_et4;
  END IF;

  INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
  SELECT v_processo, v_et1, v_et2, 'se_concluida', NULL
  WHERE NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_et1 AND para_etapa_id=v_et2);

  INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
  SELECT v_processo, v_et2, v_et3, 'se_concluida', 15
  WHERE NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_et2 AND para_etapa_id=v_et3);

  INSERT INTO public.processo_ligacoes (processo_id, de_etapa_id, para_etapa_id, condicao, sla_handoff_minutos)
  SELECT v_processo, v_et3, v_et4, 'se_concluida', 15
  WHERE NOT EXISTS (SELECT 1 FROM public.processo_ligacoes WHERE de_etapa_id=v_et3 AND para_etapa_id=v_et4);
END $$;
