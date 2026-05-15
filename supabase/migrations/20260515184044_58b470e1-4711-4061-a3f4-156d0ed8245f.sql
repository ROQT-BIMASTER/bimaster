-- 1) rpc_aprovar_cadeia_precos: escopo OBRIGATÓRIO. Sem escopo => exception.
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
  v_aprovadas uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.check_user_access(v_uid, 'precos') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar tabelas de preço';
  END IF;

  IF p_produto_ids IS NULL OR array_length(p_produto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escopo de produtos obrigatório para aprovação em cascata';
  END IF;

  UPDATE public.fabrica_tabelas_preco
     SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
   WHERE id = p_tabela_raiz_id AND status = 'pending_approval';

  IF FOUND THEN
    v_aprovadas := array_append(v_aprovadas, p_tabela_raiz_id);
    v_total := v_total + 1;

    UPDATE public.fabrica_tabelas_preco_versoes
       SET aprovado_por = v_uid, aprovado_em = now()
     WHERE id = (
       SELECT id FROM public.fabrica_tabelas_preco_versoes
        WHERE tabela_id = p_tabela_raiz_id AND aprovado_em IS NULL
        ORDER BY versao DESC LIMIT 1
     );

    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
    VALUES (p_tabela_raiz_id, v_uid, 'approved',
      'Aprovação em cascata (raiz) — escopo: ' || array_length(p_produto_ids,1) || ' produto(s)');
  END IF;

  FOREACH v_tabela_id IN ARRAY COALESCE(p_tabelas_dependentes, ARRAY[]::uuid[])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.fn_cadeia_tabelas_jusante(p_tabela_raiz_id) c
       WHERE c.id = v_tabela_id AND c.nivel > 0
    ) THEN
      RAISE EXCEPTION 'Tabela % não pertence à cadeia da raiz informada', v_tabela_id;
    END IF;

    SELECT * INTO v_tabela FROM public.fabrica_tabelas_preco WHERE id = v_tabela_id;

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
      AND pb.produto_id = ANY(p_produto_ids)
    ON CONFLICT (tabela_id, produto_id) DO UPDATE
      SET custo_base = EXCLUDED.custo_base,
          custo_base_origem = EXCLUDED.custo_base_origem,
          preco_calculado = EXCLUDED.preco_calculado,
          preco_final = EXCLUDED.preco_final,
          margem_lucro_percentual = EXCLUDED.margem_lucro_percentual,
          atualizado_por = v_uid,
          data_atualizacao = now(),
          ativo = true;

    UPDATE public.fabrica_tabelas_preco
       SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
     WHERE id = v_tabela.id AND status IN ('draft', 'pending_approval');

    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
    VALUES (v_tabela.id, v_uid, 'approved',
      'Cascata de ' || p_tabela_raiz_id::text || ' — escopo: ' || array_length(p_produto_ids,1) || ' produto(s)');

    v_aprovadas := array_append(v_aprovadas, v_tabela.id);
    v_total := v_total + 1;
  END LOOP;

  RETURN jsonb_build_object('total', v_total, 'tabelas_aprovadas', v_aprovadas);
END;
$function$;

-- 2) RPC atômica: registra escopo + dispara trigger numa só transação com GUC populado.
CREATE OR REPLACE FUNCTION public.rpc_submeter_tabela_para_aprovacao(
  p_tabela_id uuid,
  p_produto_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_versao_id uuid;
  v_versao int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_produto_ids IS NULL OR array_length(p_produto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Escopo de produtos obrigatório para envio à aprovação';
  END IF;

  PERFORM set_config('app.escopo_submissao', array_to_string(p_produto_ids, ','), true);

  UPDATE public.fabrica_tabelas_preco
     SET status = 'pending_approval', ativo = true
   WHERE id = p_tabela_id;

  -- Garante escopo gravado mesmo se trigger não leu o GUC
  SELECT id, versao INTO v_versao_id, v_versao
    FROM public.fabrica_tabelas_preco_versoes
   WHERE tabela_id = p_tabela_id
   ORDER BY versao DESC LIMIT 1;

  IF v_versao_id IS NOT NULL THEN
    UPDATE public.fabrica_tabelas_preco_versoes
       SET produto_ids_escopo = p_produto_ids,
           precos_snapshot = COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'produto_id', produto_id,
               'custo_base', custo_base,
               'preco_final', preco_final,
               'margem_lucro_percentual', margem_lucro_percentual
             ))
             FROM public.fabrica_precos_produtos
             WHERE tabela_id = p_tabela_id AND produto_id = ANY(p_produto_ids)
           ), '[]'::jsonb)
     WHERE id = v_versao_id;
  END IF;

  RETURN jsonb_build_object('versao_id', v_versao_id, 'versao', v_versao, 'escopo', array_length(p_produto_ids,1));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_submeter_tabela_para_aprovacao(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submeter_tabela_para_aprovacao(uuid, uuid[]) TO authenticated;