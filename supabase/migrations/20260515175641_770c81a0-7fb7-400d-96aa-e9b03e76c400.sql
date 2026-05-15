
-- 1) RPC: registra escopo + reescreve snapshot somente com os produtos enviados.
CREATE OR REPLACE FUNCTION public.rpc_registrar_escopo_versao(
  p_versao_id uuid,
  p_produto_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tabela uuid;
  v_created_by uuid;
  v_aprovado timestamptz;
  v_snapshot jsonb;
BEGIN
  SELECT tabela_id, created_by, aprovado_em
    INTO v_tabela, v_created_by, v_aprovado
  FROM fabrica_tabelas_preco_versoes WHERE id = p_versao_id;

  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Versão não encontrada';
  END IF;
  IF v_created_by <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar esta versão';
  END IF;
  IF v_aprovado IS NOT NULL THEN
    RAISE EXCEPTION 'Versão já aprovada — escopo não pode ser alterado';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'produto_id', produto_id,
      'custo_base', custo_base,
      'preco_final', preco_final,
      'margem_lucro_percentual', margem_lucro_percentual
    )
  ) INTO v_snapshot
  FROM fabrica_precos_produtos
  WHERE tabela_id = v_tabela
    AND produto_id = ANY(p_produto_ids);

  UPDATE fabrica_tabelas_preco_versoes
     SET produto_ids_escopo = p_produto_ids,
         precos_snapshot = COALESCE(v_snapshot, '[]'::jsonb)
   WHERE id = p_versao_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_escopo_versao(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_escopo_versao(uuid, uuid[]) TO authenticated;

-- 2) Corrige trigger: produto_ids_escopo é uuid[], não text[].
CREATE OR REPLACE FUNCTION public.criar_versao_tabela_preco()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_versao integer;
  v_precos jsonb;
  v_escopo_raw text;
  v_escopo uuid[];
BEGIN
  IF NEW.status = 'pending_approval' AND (OLD.status IS NULL OR OLD.status != 'pending_approval') THEN
    SELECT COALESCE(MAX(versao), 0) + 1 INTO v_versao
    FROM fabrica_tabelas_preco_versoes
    WHERE tabela_id = NEW.id;

    v_escopo_raw := current_setting('app.escopo_submissao', true);
    IF v_escopo_raw IS NOT NULL AND length(trim(v_escopo_raw)) > 0 THEN
      BEGIN
        v_escopo := string_to_array(v_escopo_raw, ',')::uuid[];
      EXCEPTION WHEN others THEN
        v_escopo := NULL;
      END;
    END IF;

    SELECT jsonb_agg(
      jsonb_build_object(
        'produto_id', produto_id,
        'custo_base', custo_base,
        'preco_final', preco_final,
        'margem_lucro_percentual', margem_lucro_percentual
      )
    ) INTO v_precos
    FROM fabrica_precos_produtos
    WHERE tabela_id = NEW.id
      AND (v_escopo IS NULL OR produto_id = ANY(v_escopo));

    INSERT INTO fabrica_tabelas_preco_versoes (
      tabela_id, versao, precos_snapshot, created_by, produto_ids_escopo
    ) VALUES (
      NEW.id, v_versao, COALESCE(v_precos, '[]'::jsonb), auth.uid(), v_escopo
    );

    INSERT INTO fabrica_tabelas_preco_auditoria (
      tabela_id, user_id, acao, mensagem
    ) VALUES (
      NEW.id, auth.uid(), 'pending_approval',
      'Tabela enviada para aprovação - Versão ' || v_versao
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) RPC para aprovar um lote (versão) específico.
CREATE OR REPLACE FUNCTION public.rpc_aprovar_lote_versao(
  p_versao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tabela uuid;
  v_outras_pendentes int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT tabela_id INTO v_tabela
  FROM fabrica_tabelas_preco_versoes
  WHERE id = p_versao_id AND aprovado_em IS NULL;

  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Lote não encontrado ou já aprovado';
  END IF;

  UPDATE fabrica_tabelas_preco_versoes
     SET aprovado_em = now(), aprovado_por = v_uid
   WHERE id = p_versao_id;

  SELECT count(*) INTO v_outras_pendentes
  FROM fabrica_tabelas_preco_versoes
  WHERE tabela_id = v_tabela AND aprovado_em IS NULL;

  IF v_outras_pendentes = 0 THEN
    UPDATE fabrica_tabelas_preco
       SET status = 'approved', aprovado_por = v_uid, aprovado_em = now()
     WHERE id = v_tabela;
  END IF;

  INSERT INTO fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
  VALUES (v_tabela, v_uid, 'approved', 'Lote/versão aprovada: ' || p_versao_id::text);

  RETURN jsonb_build_object('ok', true, 'tabela_aprovada', v_outras_pendentes = 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aprovar_lote_versao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_aprovar_lote_versao(uuid) TO authenticated;

-- 4) RPC para rejeitar um lote específico (descarta apenas aquela versão).
CREATE OR REPLACE FUNCTION public.rpc_rejeitar_lote_versao(
  p_versao_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tabela uuid;
  v_outras_pendentes int;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT tabela_id INTO v_tabela
  FROM fabrica_tabelas_preco_versoes
  WHERE id = p_versao_id AND aprovado_em IS NULL;

  IF v_tabela IS NULL THEN
    RAISE EXCEPTION 'Lote não encontrado ou já aprovado';
  END IF;

  UPDATE fabrica_tabelas_preco_versoes
     SET aprovado_em = now(),
         aprovado_por = v_uid,
         observacao_aprovacao = COALESCE('REJEITADA: ' || p_motivo, 'REJEITADA')
   WHERE id = p_versao_id;

  SELECT count(*) INTO v_outras_pendentes
  FROM fabrica_tabelas_preco_versoes
  WHERE tabela_id = v_tabela AND aprovado_em IS NULL;

  IF v_outras_pendentes = 0 THEN
    UPDATE fabrica_tabelas_preco SET status = 'draft' WHERE id = v_tabela;
  END IF;

  INSERT INTO fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
  VALUES (v_tabela, v_uid, 'rejected', 'Lote/versão rejeitada: ' || COALESCE(p_motivo, ''));

  RETURN jsonb_build_object('ok', true, 'tabela_para_draft', v_outras_pendentes = 0);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rejeitar_lote_versao(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_rejeitar_lote_versao(uuid, text) TO authenticated;
