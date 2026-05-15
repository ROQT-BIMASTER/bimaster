CREATE OR REPLACE FUNCTION public.rpc_aprovar_lote_versao_parcial(
  p_versao_id uuid,
  p_produto_ids_aprovados uuid[],
  p_motivo_rejeicao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tabela uuid;
  v_escopo_atual uuid[];
  v_aprovados uuid[];
  v_rejeitados uuid[];
  v_outras_pendentes int;
  v_total_aprovados int;
  v_total_rejeitados int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT tabela_id, COALESCE(produto_ids_escopo, ARRAY[]::uuid[])
    INTO v_tabela, v_escopo_atual
    FROM fabrica_tabelas_preco_versoes
   WHERE id = p_versao_id AND aprovado_em IS NULL;

  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Lote não encontrado ou já processado';
  END IF;

  -- Dedup + intersect com o escopo do lote (não permite aprovar nada fora do lote)
  SELECT array_agg(DISTINCT pid) INTO v_aprovados
    FROM unnest(COALESCE(p_produto_ids_aprovados, ARRAY[]::uuid[])) AS pid
   WHERE pid IS NOT NULL AND pid = ANY(v_escopo_atual);

  -- Calcula rejeitados = escopo \ aprovados
  SELECT array_agg(pid) INTO v_rejeitados
    FROM unnest(v_escopo_atual) AS pid
   WHERE NOT (pid = ANY(COALESCE(v_aprovados, ARRAY[]::uuid[])));

  v_total_aprovados := COALESCE(array_length(v_aprovados, 1), 0);
  v_total_rejeitados := COALESCE(array_length(v_rejeitados, 1), 0);

  -- Caso tudo rejeitado: comporta como rpc_rejeitar_lote_versao
  IF v_total_aprovados = 0 THEN
    UPDATE fabrica_tabelas_preco_versoes
       SET aprovado_em = now(),
           aprovado_por = v_uid,
           observacao_aprovacao = COALESCE('REJEITADA (parcial): ' || p_motivo_rejeicao, 'REJEITADA')
     WHERE id = p_versao_id;

    -- Desativa preços rejeitados na tabela
    UPDATE fabrica_precos_produtos
       SET ativo = false, atualizado_por = v_uid, data_atualizacao = now()
     WHERE tabela_id = v_tabela AND produto_id = ANY(v_rejeitados);

    INSERT INTO fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
    VALUES (
      v_tabela, v_uid, 'rejected',
      'Lote rejeitado integralmente via aprovação parcial: ' || COALESCE(p_motivo_rejeicao, ''),
      jsonb_build_object(
        'versao_id', p_versao_id,
        'rejeitados', to_jsonb(v_rejeitados),
        'motivo', p_motivo_rejeicao
      )
    );
  ELSE
    -- Aprovação parcial: shrink escopo para os aprovados
    UPDATE fabrica_tabelas_preco_versoes
       SET aprovado_em = now(),
           aprovado_por = v_uid,
           produto_ids_escopo = v_aprovados,
           observacao_aprovacao = CASE
             WHEN v_total_rejeitados > 0
               THEN format('APROVAÇÃO PARCIAL: %s aprovado(s), %s rejeitado(s). %s',
                           v_total_aprovados, v_total_rejeitados,
                           COALESCE(p_motivo_rejeicao, ''))
             ELSE NULL
           END
     WHERE id = p_versao_id;

    -- Desativa preços rejeitados (apenas os fora da seleção)
    IF v_total_rejeitados > 0 THEN
      UPDATE fabrica_precos_produtos
         SET ativo = false, atualizado_por = v_uid, data_atualizacao = now()
       WHERE tabela_id = v_tabela AND produto_id = ANY(v_rejeitados);
    END IF;

    INSERT INTO fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem, diff)
    VALUES (
      v_tabela, v_uid,
      CASE WHEN v_total_rejeitados > 0 THEN 'lote_aprovado_parcial' ELSE 'approved' END,
      format('Lote v%s: %s aprovado(s), %s rejeitado(s)',
             p_versao_id::text, v_total_aprovados, v_total_rejeitados),
      jsonb_build_object(
        'versao_id', p_versao_id,
        'aprovados', to_jsonb(v_aprovados),
        'rejeitados', to_jsonb(v_rejeitados),
        'motivo_rejeicao', p_motivo_rejeicao
      )
    );
  END IF;

  -- Atualiza status da tabela quando não há mais lotes pendentes
  SELECT count(*) INTO v_outras_pendentes
    FROM fabrica_tabelas_preco_versoes
   WHERE tabela_id = v_tabela AND aprovado_em IS NULL;

  IF v_outras_pendentes = 0 THEN
    IF v_total_aprovados > 0 THEN
      UPDATE fabrica_tabelas_preco
         SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
       WHERE id = v_tabela;
    ELSE
      UPDATE fabrica_tabelas_preco SET status = 'draft' WHERE id = v_tabela;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'aprovados', to_jsonb(v_aprovados),
    'rejeitados', to_jsonb(v_rejeitados),
    'total_aprovados', v_total_aprovados,
    'total_rejeitados', v_total_rejeitados,
    'tabela_finalizada', v_outras_pendentes = 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_aprovar_lote_versao_parcial(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_aprovar_lote_versao_parcial(uuid, uuid[], text) TO authenticated;