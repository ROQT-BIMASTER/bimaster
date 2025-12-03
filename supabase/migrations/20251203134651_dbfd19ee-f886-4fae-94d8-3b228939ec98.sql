-- Criar função para registrar histórico de preços
CREATE OR REPLACE FUNCTION public.registrar_historico_preco_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se houve alteração no preço final
  IF (TG_OP = 'UPDATE' AND OLD.preco_final IS DISTINCT FROM NEW.preco_final) THEN
    INSERT INTO fabrica_historico_precos (
      produto_id,
      tabela_id,
      preco_anterior,
      preco_novo,
      motivo_alteracao,
      data_alteracao,
      alterado_por
    ) VALUES (
      NEW.produto_id,
      NEW.tabela_id,
      OLD.preco_final,
      NEW.preco_final,
      COALESCE(NEW.custo_base_origem, 'Atualização de preço'),
      NOW(),
      NEW.atualizado_por
    );
    
    -- Criar alerta se variação for maior que 10%
    IF OLD.preco_final > 0 THEN
      DECLARE
        variacao DECIMAL;
      BEGIN
        variacao := ((NEW.preco_final - OLD.preco_final) / OLD.preco_final) * 100;
        
        IF ABS(variacao) >= 10 THEN
          INSERT INTO fabrica_alertas_precos (
            tabela_id,
            produto_id,
            tipo_alerta,
            titulo,
            mensagem,
            severidade,
            dados_alerta
          ) VALUES (
            NEW.tabela_id,
            NEW.produto_id,
            'variacao_alta',
            CASE WHEN variacao > 0 THEN 'Aumento significativo de preço' ELSE 'Redução significativa de preço' END,
            'Variação de ' || ROUND(variacao, 1)::text || '% detectada no preço do produto',
            CASE WHEN ABS(variacao) >= 20 THEN 'critical' ELSE 'warning' END,
            jsonb_build_object(
              'preco_anterior', OLD.preco_final,
              'preco_novo', NEW.preco_final,
              'variacao_percentual', ROUND(variacao, 2)
            )
          );
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela de preços
DROP TRIGGER IF EXISTS trigger_registrar_historico_preco ON fabrica_precos_produtos;
CREATE TRIGGER trigger_registrar_historico_preco
AFTER UPDATE ON fabrica_precos_produtos
FOR EACH ROW
EXECUTE FUNCTION registrar_historico_preco_produto();

-- Criar função para verificar margens baixas
CREATE OR REPLACE FUNCTION public.verificar_margem_baixa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se margem é muito baixa (menos de 10%)
  IF NEW.margem_lucro_percentual IS NOT NULL AND NEW.margem_lucro_percentual < 10 THEN
    -- Verificar se já existe alerta ativo para este produto/tabela
    IF NOT EXISTS (
      SELECT 1 FROM fabrica_alertas_precos 
      WHERE produto_id = NEW.produto_id 
        AND tabela_id = NEW.tabela_id 
        AND tipo_alerta = 'margem_baixa'
        AND resolvido = false
    ) THEN
      INSERT INTO fabrica_alertas_precos (
        tabela_id,
        produto_id,
        tipo_alerta,
        titulo,
        mensagem,
        severidade,
        dados_alerta
      ) VALUES (
        NEW.tabela_id,
        NEW.produto_id,
        'margem_baixa',
        'Margem de lucro abaixo do ideal',
        'Produto com margem de apenas ' || ROUND(NEW.margem_lucro_percentual, 1)::text || '%',
        CASE WHEN NEW.margem_lucro_percentual < 5 THEN 'critical' ELSE 'warning' END,
        jsonb_build_object(
          'margem_atual', NEW.margem_lucro_percentual,
          'custo_base', NEW.custo_base,
          'preco_final', NEW.preco_final
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para verificar margens baixas
DROP TRIGGER IF EXISTS trigger_verificar_margem ON fabrica_precos_produtos;
CREATE TRIGGER trigger_verificar_margem
AFTER INSERT OR UPDATE ON fabrica_precos_produtos
FOR EACH ROW
EXECUTE FUNCTION verificar_margem_baixa();