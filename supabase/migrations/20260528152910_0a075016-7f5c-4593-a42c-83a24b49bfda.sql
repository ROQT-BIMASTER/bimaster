CREATE OR REPLACE FUNCTION public.get_or_create_projeto_pessoal()
RETURNS TABLE(projeto_id uuid, secao_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_proj uuid;
  v_secao uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT p.id INTO v_proj
  FROM public.projetos AS p
  WHERE p.criador_id = v_uid
    AND p.tipo = 'pessoal'
  ORDER BY p.created_at ASC
  LIMIT 1;

  IF v_proj IS NULL THEN
    INSERT INTO public.projetos (
      nome,
      descricao,
      cor,
      criador_id,
      status,
      visibilidade,
      tipo,
      regime_calendario,
      usa_feriados,
      uf_feriados,
      prazo_padrao_tarefa,
      alerta_antecipacao_dias
    )
    VALUES (
      'Pessoal',
      'Espaço pessoal para tarefas sem projeto',
      '#94a3b8',
      v_uid,
      'ativo',
      'privado',
      'pessoal',
      'corridos',
      false,
      'SP',
      7,
      2
    )
    RETURNING public.projetos.id INTO v_proj;

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_proj, v_uid, 'coordenador')
    ON CONFLICT ON CONSTRAINT projeto_membros_projeto_id_user_id_key DO NOTHING;

    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem, tem_briefing)
    VALUES (v_proj, 'Minhas tarefas', 0, false)
    RETURNING public.projeto_secoes.id INTO v_secao;
  ELSE
    SELECT s.id INTO v_secao
    FROM public.projeto_secoes AS s
    WHERE s.projeto_id = v_proj
    ORDER BY COALESCE(s.ordem, 0) ASC, s.created_at ASC
    LIMIT 1;

    IF v_secao IS NULL THEN
      INSERT INTO public.projeto_secoes (projeto_id, nome, ordem, tem_briefing)
      VALUES (v_proj, 'Minhas tarefas', 0, false)
      RETURNING public.projeto_secoes.id INTO v_secao;
    END IF;

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_proj, v_uid, 'coordenador')
    ON CONFLICT ON CONSTRAINT projeto_membros_projeto_id_user_id_key DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT v_proj AS projeto_id, v_secao AS secao_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_or_create_projeto_pessoal() TO authenticated;