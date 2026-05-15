CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadeia_precos(
  p_tabela_raiz_id uuid,
  p_tabelas_dependentes uuid[],
  p_produto_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tabela_id uuid;
  v_tabela public.fabrica_tabelas_preco%ROWTYPE;
  v_total int := 0;
  v_aprovadas jsonb := '[]'::jsonb;
  v_falhas jsonb := '[]'::jsonb;
  v_produto_ids uuid[];
  v_escopo_size int;
  v_linhas_afetadas int;
  v_raiz_aprovada boolean := false;
  v_err text;
  v_started_at timestamptz := clock_timestamp();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.check_user_access(v_uid, 'precos') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar tabelas de preço';
  END IF;

  -- Validação 1: escopo obrigatório
  IF p_produto_ids IS NULL OR array_length(p_produto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escopo de produtos obrigatório para aprovação em cascata';
  END IF;

  -- Validação 2: dedup do escopo (evita inflar logs/contagens)
  SELECT array_agg(DISTINCT pid) INTO v_produto_ids
    FROM unnest(p_produto_ids) AS pid
   WHERE pid IS NOT NULL;

  v_escopo_size := COALESCE(array_length(v_produto_ids, 1), 0);

  IF v_escopo_size = 0 THEN
    RAISE EXCEPTION 'Escopo de produtos vazio após deduplicação';
  END IF;

  -- Validação 3: raiz precisa existir
  SELECT * INTO v_tabela FROM public.fabrica_tabelas_preco WHERE id = p_tabela_raiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tabela raiz % não encontrada', p_tabela_raiz_id;
  END IF;

  -- Aprova raiz (apenas se estava pending_approval)
  UPDATE public.fabrica_tabelas_preco
     SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
   WHERE id = p_tabela_raiz_id AND status = 'pending_approval';

  IF FOUND THEN
    v_raiz_aprovada := true;
    v_total := v_total + 1;
    v_aprovadas := v_aprovadas || jsonb_build_object(
      'tabela_id', p_tabela_raiz_id,
      'tipo', 'raiz',
      'linhas_afetadas', v_escopo_size
    );

    UPDATE public.fabrica_tabelas_preco_versoes
       SET aprovado_por = v_uid, aprovado_em = now()
     WHERE id = (
       SELECT id FROM public.fabrica_tabelas_preco_versoes
        WHERE tabela_id = p_tabela_raiz_id AND aprovado_em IS NULL
        ORDER BY versao DESC LIMIT 1
     );

    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
    VALUES (
      p_tabela_raiz_id, v_uid, 'cascata_raiz_aprovada',
      format('Cascata: raiz aprovada com %s produto(s)', v_escopo_size),
      jsonb_build_object(
        'escopo_size', v_escopo_size,
        'produto_ids', to_jsonb(v_produto_ids),
        'tabelas_dependentes_solicitadas', to_jsonb(COALESCE(p_tabelas_dependentes, ARRAY[]::uuid[])),
        'started_at', v_started_at
      )
    );
  ELSE
    -- raiz já estava aprovada (ou em outro estado) — registra mas não falha o lote
    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
    VALUES (
      p_tabela_raiz_id, v_uid, 'cascata_raiz_ignorada',
      'Cascata: raiz não estava em pending_approval, prosseguindo com dependentes',
      jsonb_build_object('status_atual', v_tabela.status, 'escopo_size', v_escopo_size)
    );
  END IF;

  -- Itera dependentes: cada uma em bloco isolado para falha parcial
  FOREACH v_tabela_id IN ARRAY COALESCE(p_tabelas_dependentes, ARRAY[]::uuid[])
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.fn_cadeia_tabelas_jusante(p_tabela_raiz_id) c
         WHERE c.id = v_tabela_id AND c.nivel > 0
      ) THEN
        RAISE EXCEPTION 'Tabela % não pertence à cadeia da raiz informada', v_tabela_id;
      END IF;

      SELECT * INTO v_tabela FROM public.fabrica_tabelas_preco WHERE id = v_tabela_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Tabela dependente % não encontrada', v_tabela_id;
      END IF;

      WITH upserted AS (
        INSERT INTO public.fabrica_precos_produtos (
          tabela_id, produto_id, custo_base, custo_base_origem,
          preco_calculado, preco_final, margem_lucro_percentual,
          ativo, atualizado_por, data_atualizacao
        )
        SELECT
          v_tabela.id,
          pb.produto_id,
          pb.preco_final,
          'tabela_anterior',
          CASE v_tabela.tipo_markup
            WHEN 'percentual'    THEN pb.preco_final * (1 + v_tabela.valor_markup / 100.0)
            WHEN 'multiplicador' THEN pb.preco_final * v_tabela.valor_markup
            WHEN 'valor_fixo'    THEN pb.preco_final + v_tabela.valor_markup
            ELSE pb.preco_final
          END,
          CASE v_tabela.tipo_markup
            WHEN 'percentual'    THEN pb.preco_final * (1 + v_tabela.valor_markup / 100.0)
            WHEN 'multiplicador' THEN pb.preco_final * v_tabela.valor_markup
            WHEN 'valor_fixo'    THEN pb.preco_final + v_tabela.valor_markup
            ELSE pb.preco_final
          END,
          CASE WHEN pb.preco_final > 0 THEN
            ((CASE v_tabela.tipo_markup
                WHEN 'percentual'    THEN pb.preco_final * (1 + v_tabela.valor_markup / 100.0)
                WHEN 'multiplicador' THEN pb.preco_final * v_tabela.valor_markup
                WHEN 'valor_fixo'    THEN pb.preco_final + v_tabela.valor_markup
                ELSE pb.preco_final
              END) - pb.preco_final
            ) / NULLIF(
              CASE v_tabela.tipo_markup
                WHEN 'percentual'    THEN pb.preco_final * (1 + v_tabela.valor_markup / 100.0)
                WHEN 'multiplicador' THEN pb.preco_final * v_tabela.valor_markup
                WHEN 'valor_fixo'    THEN pb.preco_final + v_tabela.valor_markup
                ELSE pb.preco_final
              END, 0
            ) * 100.0
          ELSE 0 END,
          true, v_uid, now()
        FROM public.fabrica_precos_produtos pb
        WHERE pb.tabela_id = v_tabela.tabela_base_id
          AND pb.ativo = true
          AND pb.produto_id = ANY(v_produto_ids)
        ON CONFLICT (tabela_id, produto_id) DO UPDATE
          SET custo_base = EXCLUDED.custo_base,
              custo_base_origem = EXCLUDED.custo_base_origem,
              preco_calculado = EXCLUDED.preco_calculado,
              preco_final = EXCLUDED.preco_final,
              margem_lucro_percentual = EXCLUDED.margem_lucro_percentual,
              atualizado_por = v_uid,
              data_atualizacao = now(),
              ativo = true
        RETURNING 1
      )
      SELECT count(*) INTO v_linhas_afetadas FROM upserted;

      UPDATE public.fabrica_tabelas_preco
         SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
       WHERE id = v_tabela.id AND status IN ('draft', 'pending_approval');

      INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
      VALUES (
        v_tabela.id, v_uid, 'cascata_dependente_aprovada',
        format('Cascata de %s — %s linhas atualizadas (%s produtos no escopo)',
               p_tabela_raiz_id::text, v_linhas_afetadas, v_escopo_size),
        jsonb_build_object(
          'tabela_raiz_id', p_tabela_raiz_id,
          'escopo_size', v_escopo_size,
          'produto_ids', to_jsonb(v_produto_ids),
          'linhas_afetadas', v_linhas_afetadas,
          'tipo_markup', v_tabela.tipo_markup,
          'valor_markup', v_tabela.valor_markup
        )
      );

      v_aprovadas := v_aprovadas || jsonb_build_object(
        'tabela_id', v_tabela.id,
        'tipo', 'dependente',
        'linhas_afetadas', v_linhas_afetadas
      );
      v_total := v_total + 1;

    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
      -- Auditoria de falha (em transação separada via subtransação implícita do BEGIN/EXCEPTION)
      INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
      VALUES (
        v_tabela_id, v_uid, 'cascata_dependente_falhou',
        format('Falha em cascata: %s', v_err),
        jsonb_build_object(
          'tabela_raiz_id', p_tabela_raiz_id,
          'escopo_size', v_escopo_size,
          'produto_ids', to_jsonb(v_produto_ids),
          'erro', v_err,
          'sqlstate', SQLSTATE
        )
      );

      v_falhas := v_falhas || jsonb_build_object(
        'tabela_id', v_tabela_id,
        'erro', v_err,
        'sqlstate', SQLSTATE
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'tabelas_aprovadas', v_aprovadas,
    'tabelas_falhadas', v_falhas,
    'produtos_afetados', to_jsonb(v_produto_ids),
    'escopo_size', v_escopo_size,
    'raiz_aprovada', v_raiz_aprovada,
    'duracao_ms', extract(milliseconds from (clock_timestamp() - v_started_at))::int
  );
END;
$function$;