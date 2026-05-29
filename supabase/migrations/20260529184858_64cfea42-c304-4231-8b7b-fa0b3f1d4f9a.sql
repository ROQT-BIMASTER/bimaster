-- RPC transacional para criação de projetos
-- Evita falhas RLS intermitentes ao consolidar projeto + coordenador + departamentos + seções em uma única chamada SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.rpc_criar_projeto(
  _payload jsonb
)
RETURNS public.projetos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _aprovado boolean;
  _status text;
  _projeto public.projetos;
  _dept_id uuid;
  _secao jsonb;
  _meta jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- Bloqueia somente usuários explicitamente desativados; usuários sem profile ainda conseguem operar
  SELECT COALESCE(aprovado, true), COALESCE(status, 'ativo')
    INTO _aprovado, _status
    FROM public.profiles
   WHERE id = _uid;

  IF FOUND AND (_aprovado = false OR _status <> 'ativo') THEN
    RAISE EXCEPTION 'user_not_active' USING ERRCODE = '28000';
  END IF;

  INSERT INTO public.projetos (
    nome, descricao, cor, icone, criador_id, tipo,
    marca, categoria_linha, origem_projeto,
    regime_calendario, usa_feriados, uf_feriados,
    data_inicio, data_fim_alvo,
    prazo_padrao_tarefa, alerta_antecipacao_dias,
    departamento_id
  )
  VALUES (
    COALESCE(_payload->>'nome', 'Sem título'),
    NULLIF(_payload->>'descricao',''),
    COALESCE(NULLIF(_payload->>'cor',''), '#6366f1'),
    COALESCE(NULLIF(_payload->>'icone',''), 'folder'),
    _uid,
    COALESCE(NULLIF(_payload->>'tipo',''), 'generico'),
    NULLIF(_payload->>'marca',''),
    NULLIF(_payload->>'categoria_linha',''),
    COALESCE(NULLIF(_payload->>'origem_projeto',''), 'brasil'),
    COALESCE(NULLIF(_payload->>'regime_calendario',''), 'dias_uteis'),
    COALESCE((_payload->>'usa_feriados')::boolean, true),
    COALESCE(NULLIF(_payload->>'uf_feriados',''), 'BR'),
    NULLIF(_payload->>'data_inicio','')::date,
    NULLIF(_payload->>'data_fim_alvo','')::date,
    COALESCE((_payload->>'prazo_padrao_tarefa')::int, 5),
    COALESCE((_payload->>'alerta_antecipacao_dias')::int, 2),
    NULLIF(_payload->>'departamento_id','')::uuid
  )
  RETURNING * INTO _projeto;

  -- Coordenador
  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  VALUES (_projeto.id, _uid, 'coordenador')
  ON CONFLICT DO NOTHING;

  -- Departamentos
  IF jsonb_typeof(_payload->'departamento_ids') = 'array' THEN
    FOR _dept_id IN
      SELECT (value)::uuid FROM jsonb_array_elements_text(_payload->'departamento_ids')
    LOOP
      INSERT INTO public.projeto_departamentos (projeto_id, departamento_id)
      VALUES (_projeto.id, _dept_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Seções iniciais (lista de nomes)
  IF jsonb_typeof(_payload->'secoes') = 'array' THEN
    FOR _secao IN
      SELECT value FROM jsonb_array_elements(_payload->'secoes')
    LOOP
      INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
      VALUES (
        _projeto.id,
        COALESCE(_secao->>'nome', _secao#>>'{}'),
        COALESCE((_secao->>'ordem')::int, 0)
      );
    END LOOP;
  END IF;

  -- Metas iniciais
  IF jsonb_typeof(_payload->'metas_iniciais') = 'array' THEN
    FOR _meta IN
      SELECT value FROM jsonb_array_elements(_payload->'metas_iniciais')
    LOOP
      INSERT INTO public.projeto_metas (
        projeto_id, titulo, tipo, valor_alvo, valor_atual,
        unidade, data_alvo, peso, status, created_by
      )
      VALUES (
        _projeto.id,
        _meta->>'titulo',
        _meta->>'tipo',
        COALESCE((_meta->>'valor_alvo')::numeric, 0),
        0,
        NULLIF(_meta->>'unidade',''),
        NULLIF(_meta->>'data_alvo','')::date,
        COALESCE((_meta->>'peso')::numeric, 1),
        'em_andamento',
        _uid
      );
    END LOOP;
  END IF;

  RETURN _projeto;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_projeto(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_criar_projeto(jsonb) TO authenticated;