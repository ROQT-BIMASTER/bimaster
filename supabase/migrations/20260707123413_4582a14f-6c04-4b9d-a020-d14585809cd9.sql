
-- Backfill sem exigir auth.uid() (uso interno da migration)
CREATE OR REPLACE FUNCTION public._backfill_projeto_departamentos()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_owner uuid;
  v_projeto uuid;
  v_secao_espera uuid; v_secao_analise uuid; v_secao_fim uuid; v_secao_rej uuid;
  v_count integer := 0;
BEGIN
  FOR r IN SELECT id, nome, cor FROM public.suporte_filas WHERE projeto_id IS NULL AND ativo LOOP
    -- Descobre um owner: líder da fila ou primeiro admin ativo
    SELECT user_id INTO v_owner
      FROM public.suporte_fila_agentes
     WHERE fila_id = r.id AND ativo AND papel='lider'
     LIMIT 1;
    IF v_owner IS NULL THEN
      SELECT user_id INTO v_owner FROM public.user_roles WHERE role = 'admin'::app_role LIMIT 1;
    END IF;
    IF v_owner IS NULL THEN
      RAISE NOTICE 'Sem owner para fila %; pulando', r.nome;
      CONTINUE;
    END IF;

    INSERT INTO public.projetos (nome, descricao, cor, icone, criador_id, status, tipo, visibilidade)
    VALUES ('Suporte - ' || r.nome, 'Fluxo de chamados do departamento ' || r.nome || '.',
            coalesce(r.cor, '#185FA5'), 'life-buoy', v_owner, 'ativo', 'generico', 'equipe')
    RETURNING id INTO v_projeto;

    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em espera',1)  RETURNING id INTO v_secao_espera;
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em analise',2) RETURNING id INTO v_secao_analise;
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Finalizado',3) RETURNING id INTO v_secao_fim;
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Rejeitado',4)  RETURNING id INTO v_secao_rej;

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    SELECT v_projeto, fa.user_id, CASE fa.papel WHEN 'lider' THEN 'coordenador' ELSE 'membro' END
      FROM public.suporte_fila_agentes fa WHERE fa.fila_id = r.id AND fa.ativo
    ON CONFLICT DO NOTHING;

    -- Garante que o owner esteja como membro coordenador
    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_projeto, v_owner, 'coordenador')
    ON CONFLICT DO NOTHING;

    UPDATE public.suporte_filas SET projeto_id = v_projeto WHERE id = r.id;

    INSERT INTO public.suporte_etapa_mensagens (fila_id, secao_id, mensagem, status_map, notificar) VALUES
      (r.id, v_secao_espera,  'Seu chamado {protocolo} foi recebido pela equipe de {departamento} e esta na fila de trabalho.', 'em_triagem', true),
      (r.id, v_secao_analise, 'Boa noticia: o chamado {protocolo} esta em analise - ja tem alguem trabalhando no assunto.', 'em_atendimento', true),
      (r.id, v_secao_fim,     'O chamado {protocolo} - {titulo} - foi concluido pela equipe de {departamento}. Se o problema persistir, basta responder por aqui.', 'resolvido', true),
      (r.id, v_secao_rej,     'O chamado {protocolo} foi analisado e nao seguira adiante. A equipe de {departamento} registrou o motivo na conversa.', 'resolvido', true)
    ON CONFLICT (fila_id, secao_id) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

SELECT public._backfill_projeto_departamentos();

DROP FUNCTION public._backfill_projeto_departamentos();
