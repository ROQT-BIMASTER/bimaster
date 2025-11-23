-- Corrigir search_path das funções criadas na Fase 1

CREATE OR REPLACE FUNCTION calcular_duracao_parada()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.timestamp_fim IS NOT NULL THEN
    NEW.duracao_minutos := EXTRACT(EPOCH FROM (NEW.timestamp_fim - NEW.timestamp_inicio)) / 60;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION atualizar_status_op_apontamento()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'inicio' THEN
    UPDATE fabrica_ordens_producao
    SET status = 'em_producao', data_inicio_real = NEW.timestamp_evento
    WHERE id = NEW.ordem_producao_id AND status = 'pendente';
  ELSIF NEW.tipo = 'finalizacao' THEN
    UPDATE fabrica_ordens_producao
    SET status = 'concluida', 
        data_conclusao_real = NEW.timestamp_evento,
        quantidade_produzida = (
          SELECT COALESCE(SUM(quantidade_apontada), 0)
          FROM fabrica_apontamentos
          WHERE ordem_producao_id = NEW.ordem_producao_id
        )
    WHERE id = NEW.ordem_producao_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION quarentena_lote_reprovado()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.resultado IN ('reprovado', 'quarentena') AND NEW.lote_id IS NOT NULL THEN
    UPDATE fabrica_lotes
    SET status = 'quarentena'
    WHERE id = NEW.lote_id;
  ELSIF NEW.resultado = 'aprovado' AND NEW.lote_id IS NOT NULL THEN
    UPDATE fabrica_lotes
    SET status = 'ativo'
    WHERE id = NEW.lote_id;
  END IF;
  RETURN NEW;
END;
$$;