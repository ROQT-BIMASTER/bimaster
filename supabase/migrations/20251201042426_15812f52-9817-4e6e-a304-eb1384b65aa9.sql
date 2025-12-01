-- Função para recalcular preços em cascata quando tabela base é atualizada
CREATE OR REPLACE FUNCTION recalcular_precos_cascata()
RETURNS TRIGGER AS $$
DECLARE
  tabela_rec RECORD;
  preco_base DECIMAL;
  novo_preco DECIMAL;
BEGIN
  -- Para cada tabela que depende da tabela onde o preço foi alterado
  FOR tabela_rec IN 
    SELECT DISTINCT tp.id, tp.tipo_markup, tp.valor_markup, tp.tabela_base_id
    FROM fabrica_tabelas_preco tp
    WHERE tp.tabela_base_id IN (
      SELECT tabela_id FROM fabrica_precos_produtos WHERE id = NEW.id
    )
    AND tp.ativo = true
  LOOP
    -- Buscar o preço base (o preço que acabou de ser atualizado)
    preco_base := NEW.preco_final;
    
    -- Calcular o novo preço baseado no markup da tabela dependente
    IF tabela_rec.tipo_markup = 'percentual' THEN
      novo_preco := preco_base * (1 + tabela_rec.valor_markup / 100);
    ELSIF tabela_rec.tipo_markup = 'multiplicador' THEN
      novo_preco := preco_base * tabela_rec.valor_markup;
    ELSIF tabela_rec.tipo_markup = 'valor_fixo' THEN
      novo_preco := preco_base + tabela_rec.valor_markup;
    ELSE
      novo_preco := preco_base;
    END IF;
    
    -- Atualizar o preço na tabela dependente
    UPDATE fabrica_precos_produtos
    SET 
      custo_base = preco_base,
      preco_calculado = novo_preco,
      preco_final = COALESCE(preco_manual, novo_preco),
      margem_lucro_percentual = CASE 
        WHEN preco_base > 0 THEN ((COALESCE(preco_manual, novo_preco) - preco_base) / preco_base * 100)
        ELSE 0
      END,
      updated_at = NOW()
    WHERE tabela_id = tabela_rec.id
    AND produto_id = NEW.produto_id
    AND ativo = true;
    
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para recalcular preços em cascata
DROP TRIGGER IF EXISTS trigger_recalcular_precos_cascata ON fabrica_precos_produtos;
CREATE TRIGGER trigger_recalcular_precos_cascata
AFTER UPDATE OF preco_final ON fabrica_precos_produtos
FOR EACH ROW
WHEN (OLD.preco_final IS DISTINCT FROM NEW.preco_final)
EXECUTE FUNCTION recalcular_precos_cascata();

-- Comentários
COMMENT ON FUNCTION recalcular_precos_cascata() IS 
'Recalcula automaticamente os preços em todas as tabelas dependentes quando um preço é alterado na tabela base';
COMMENT ON TRIGGER trigger_recalcular_precos_cascata ON fabrica_precos_produtos IS 
'Dispara recálculo em cascata quando preço_final é atualizado';