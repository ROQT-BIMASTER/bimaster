
-- 1) Adicionar campo de escopo nas versões (produtos efetivamente submetidos)
ALTER TABLE public.fabrica_tabelas_preco_versoes
  ADD COLUMN IF NOT EXISTS produto_ids_escopo uuid[] NULL;

COMMENT ON COLUMN public.fabrica_tabelas_preco_versoes.produto_ids_escopo IS
  'Lista de produto_ids que foram efetivamente o escopo dessa submissão. NULL = legado (todos os produtos do snapshot).';

-- 2) Função de resolução recursiva da cadeia de tabelas a jusante (downstream)
--    Retorna a tabela raiz + todas as descendentes (filhas, netas, ...) em ordem topológica.
CREATE OR REPLACE FUNCTION public.fn_cadeia_tabelas_jusante(p_root uuid)
RETURNS TABLE (
  id uuid,
  codigo varchar,
  nome varchar,
  status varchar,
  tabela_base_id uuid,
  tipo_base varchar,
  tipo_markup varchar,
  valor_markup numeric,
  ordem int,
  nivel int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE cadeia AS (
    SELECT t.id, t.codigo, t.nome, t.status, t.tabela_base_id,
           t.tipo_base, t.tipo_markup, t.valor_markup, t.ordem,
           0 AS nivel
      FROM fabrica_tabelas_preco t
     WHERE t.id = p_root
    UNION ALL
    SELECT t.id, t.codigo, t.nome, t.status, t.tabela_base_id,
           t.tipo_base, t.tipo_markup, t.valor_markup, t.ordem,
           c.nivel + 1
      FROM fabrica_tabelas_preco t
      JOIN cadeia c ON t.tabela_base_id = c.id
     WHERE c.nivel < 10
  )
  SELECT * FROM cadeia ORDER BY nivel ASC, ordem ASC, nome ASC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_cadeia_tabelas_jusante(uuid) TO authenticated;

-- 3) RPC de aprovação em cascata: aprova a tabela raiz + dependentes selecionadas
--    em uma única transação, criando versões aprovadas para cada uma com os preços
--    calculados via markup configurado.
CREATE OR REPLACE FUNCTION public.rpc_aprovar_cadeia_precos(
  p_tabela_raiz_id uuid,
  p_tabelas_dependentes uuid[],
  p_produto_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tabela record;
  v_total int := 0;
  v_aprovadas uuid[] := ARRAY[]::uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Permissão mínima: usuário precisa ter acesso ao módulo precos
  IF NOT public.check_user_access(v_uid, 'precos') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar tabelas de preço';
  END IF;

  -- 1) Aprovar a tabela raiz
  UPDATE public.fabrica_tabelas_preco
     SET status = 'approved',
         aprovado_por = v_uid,
         aprovado_em  = now()
   WHERE id = p_tabela_raiz_id
     AND status = 'pending_approval';

  IF FOUND THEN
    v_aprovadas := array_append(v_aprovadas, p_tabela_raiz_id);
    v_total := v_total + 1;

    -- Marcar a última versão pendente como aprovada
    UPDATE public.fabrica_tabelas_preco_versoes
       SET aprovado_por = v_uid, aprovado_em = now()
     WHERE id = (
       SELECT id FROM public.fabrica_tabelas_preco_versoes
        WHERE tabela_id = p_tabela_raiz_id AND aprovado_em IS NULL
        ORDER BY versao DESC LIMIT 1
     );

    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
    VALUES (p_tabela_raiz_id, v_uid, 'approved', 'Aprovação em cascata (raiz)');
  END IF;

  -- 2) Aprovar dependentes selecionadas, validando ancestralidade
  FOREACH v_tabela.id IN ARRAY COALESCE(p_tabelas_dependentes, ARRAY[]::uuid[])
  LOOP
    -- Verificar que a tabela é descendente da raiz
    IF NOT EXISTS (
      SELECT 1 FROM public.fn_cadeia_tabelas_jusante(p_tabela_raiz_id) c
       WHERE c.id = v_tabela.id AND c.nivel > 0
    ) THEN
      RAISE EXCEPTION 'Tabela % não pertence à cadeia da raiz informada', v_tabela.id;
    END IF;

    -- Buscar config da tabela
    SELECT * INTO v_tabela FROM public.fabrica_tabelas_preco WHERE id = v_tabela.id;

    -- Recalcular preços a partir da tabela base (que já foi aprovada na cascata)
    -- usando os preços vigentes em fabrica_precos_produtos da tabela base
    INSERT INTO public.fabrica_precos_produtos (
      tabela_id, produto_id, custo_base, custo_base_origem,
      preco_calculado, preco_final, margem_lucro_percentual,
      ativo, atualizado_por, data_atualizacao
    )
    SELECT
      v_tabela.id,
      pb.produto_id,
      pb.preco_final, -- custo desta tabela = preço final da tabela base
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
      AND (p_produto_ids IS NULL OR pb.produto_id = ANY(p_produto_ids))
    ON CONFLICT (tabela_id, produto_id) DO UPDATE
      SET custo_base               = EXCLUDED.custo_base,
          custo_base_origem        = EXCLUDED.custo_base_origem,
          preco_calculado          = EXCLUDED.preco_calculado,
          preco_final              = EXCLUDED.preco_final,
          margem_lucro_percentual  = EXCLUDED.margem_lucro_percentual,
          atualizado_por           = v_uid,
          data_atualizacao         = now(),
          ativo                    = true;

    UPDATE public.fabrica_tabelas_preco
       SET status = 'approved',
           aprovado_por = v_uid,
           aprovado_em  = now()
     WHERE id = v_tabela.id
       AND status IN ('draft', 'pending_approval');

    INSERT INTO public.fabrica_tabelas_preco_auditoria (tabela_id, user_id, acao, mensagem)
    VALUES (v_tabela.id, v_uid, 'approved',
      'Aprovação em cascata a partir de ' || p_tabela_raiz_id::text);

    v_aprovadas := array_append(v_aprovadas, v_tabela.id);
    v_total := v_total + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'total', v_total,
    'tabelas_aprovadas', v_aprovadas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_aprovar_cadeia_precos(uuid, uuid[], uuid[]) TO authenticated;
