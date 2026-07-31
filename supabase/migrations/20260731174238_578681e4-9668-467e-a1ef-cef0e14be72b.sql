ALTER TABLE public.fabrica_markup_overrides
  ADD COLUMN IF NOT EXISTS tabela_base_id UUID REFERENCES public.fabrica_tabelas_preco(id);

CREATE OR REPLACE FUNCTION public.recalcular_precos_cascata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tabela_rec RECORD;
  preco_base DECIMAL;
  novo_preco DECIMAL;
  v_linha TEXT;
  v_tipo TEXT;
  v_valor DECIMAL;
  v_base UUID;
BEGIN
  SELECT linha INTO v_linha FROM fabrica_produtos WHERE id = NEW.produto_id;

  FOR tabela_rec IN
    SELECT DISTINCT tp.id, tp.tipo_markup, tp.valor_markup, tp.tabela_base_id
    FROM fabrica_tabelas_preco tp
    WHERE tp.ativo = true
      AND (
        tp.tabela_base_id = NEW.tabela_id
        OR EXISTS (
          SELECT 1 FROM fabrica_markup_overrides o
          WHERE o.tabela_id = tp.id
            AND o.ativo = true
            AND o.tabela_base_id = NEW.tabela_id
            AND (o.produto_id = NEW.produto_id
                 OR (o.produto_id IS NULL AND v_linha IS NOT NULL AND o.linha = v_linha))
        )
      )
  LOOP
    v_tipo := NULL;
    v_valor := NULL;
    v_base := NULL;

    -- Exceção por produto tem prioridade sobre exceção por linha
    SELECT o.tipo_markup, o.valor_markup, o.tabela_base_id
      INTO v_tipo, v_valor, v_base
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

    -- base efetiva: override tem prioridade sobre a base padrão da tabela
    IF COALESCE(v_base, tabela_rec.tabela_base_id) IS DISTINCT FROM NEW.tabela_id THEN
      CONTINUE;
    END IF;

    preco_base := NEW.preco_final;

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
$function$;