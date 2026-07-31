CREATE OR REPLACE FUNCTION public.recalcular_precos_cascata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tabela_rec RECORD;
  preco_base DECIMAL;
  novo_preco DECIMAL;
  v_linha TEXT;
  v_tipo TEXT;
  v_valor DECIMAL;
BEGIN
  SELECT linha INTO v_linha FROM fabrica_produtos WHERE id = NEW.produto_id;

  FOR tabela_rec IN
    SELECT DISTINCT tp.id, tp.tipo_markup, tp.valor_markup
    FROM fabrica_tabelas_preco tp
    WHERE tp.tabela_base_id = NEW.tabela_id
      AND tp.ativo = true
  LOOP
    preco_base := NEW.preco_final;

    v_tipo := tabela_rec.tipo_markup;
    v_valor := tabela_rec.valor_markup;

    -- Exceção por produto tem prioridade sobre exceção por linha
    SELECT o.tipo_markup, o.valor_markup INTO v_tipo, v_valor
    FROM fabrica_markup_overrides o
    WHERE o.tabela_id = tabela_rec.id
      AND o.ativo = true
      AND (o.produto_id = NEW.produto_id
           OR (o.produto_id IS NULL AND v_linha IS NOT NULL AND o.linha = v_linha))
    ORDER BY (o.produto_id IS NOT NULL) DESC
    LIMIT 1;

    IF v_tipo IS NULL THEN
      v_tipo := tabela_rec.tipo_markup;
      v_valor := tabela_rec.valor_markup;
    END IF;

    IF v_tipo = 'percentual' THEN
      novo_preco := preco_base * (1 + v_valor / 100);
    ELSIF v_tipo = 'multiplicador' THEN
      novo_preco := preco_base * v_valor;
    ELSIF v_tipo = 'valor_fixo' THEN
      novo_preco := preco_base + v_valor;
    ELSE
      novo_preco := preco_base;
    END IF;

    UPDATE fabrica_precos_produtos
    SET
      custo_base = preco_base,
      preco_calculado = novo_preco,
      preco_final = COALESCE(preco_manual, novo_preco),
      margem_lucro_percentual = CASE
        WHEN preco_base > 0 THEN ((COALESCE(preco_manual, novo_preco) - preco_base) / preco_base * 100)
        ELSE 0
      END
    WHERE tabela_id = tabela_rec.id
      AND produto_id = NEW.produto_id
      AND ativo = true;
  END LOOP;

  RETURN NEW;
END;
$$;