-- =============================================================
-- Auditoria automática de reclassificação
-- =============================================================
-- Registra em fabrica_produtos_historico / produto_brasil_historico
-- toda mudança em campos sensíveis de classificação (origem, tipo,
-- status_lancamento), incluindo de quem partiu a alteração.
-- =============================================================

-- ---------- Fábrica ----------
CREATE OR REPLACE FUNCTION public.fn_audit_fabrica_produto_reclassificacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
BEGIN
  IF NEW.origem IS DISTINCT FROM OLD.origem THEN
    v_changes := v_changes || jsonb_build_object(
      'campo', 'origem',
      'de', OLD.origem,
      'para', NEW.origem
    );
  END IF;

  IF NEW.tipo IS DISTINCT FROM OLD.tipo THEN
    v_changes := v_changes || jsonb_build_object(
      'campo', 'tipo',
      'de', OLD.tipo,
      'para', NEW.tipo
    );
  END IF;

  IF NEW.status_lancamento IS DISTINCT FROM OLD.status_lancamento THEN
    v_changes := v_changes || jsonb_build_object(
      'campo', 'status_lancamento',
      'de', OLD.status_lancamento,
      'para', NEW.status_lancamento
    );
  END IF;

  IF jsonb_array_length(v_changes) > 0 THEN
    INSERT INTO public.fabrica_produtos_historico (
      produto_id, acao, campos_alterados, dados_anteriores, dados_novos, usuario_id
    ) VALUES (
      NEW.id,
      'reclassificacao',
      v_changes,
      jsonb_build_object('origem', OLD.origem, 'tipo', OLD.tipo, 'status_lancamento', OLD.status_lancamento),
      jsonb_build_object('origem', NEW.origem, 'tipo', NEW.tipo, 'status_lancamento', NEW.status_lancamento),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_fabrica_produto_reclassificacao ON public.fabrica_produtos;
CREATE TRIGGER trg_audit_fabrica_produto_reclassificacao
AFTER UPDATE OF origem, tipo, status_lancamento ON public.fabrica_produtos
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_fabrica_produto_reclassificacao();

-- ---------- Produto Brasil ----------
CREATE OR REPLACE FUNCTION public.fn_audit_produto_brasil_reclassificacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
BEGIN
  IF NEW.origem IS DISTINCT FROM OLD.origem THEN
    v_changes := v_changes || jsonb_build_object(
      'campo', 'origem',
      'de', OLD.origem,
      'para', NEW.origem
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_changes := v_changes || jsonb_build_object(
      'campo', 'status',
      'de', OLD.status,
      'para', NEW.status
    );
  END IF;

  IF jsonb_array_length(v_changes) > 0 THEN
    INSERT INTO public.produto_brasil_historico (
      produto_brasil_id, tipo, descricao, user_id, metadata
    ) VALUES (
      NEW.id,
      'reclassificacao',
      'Alteração de classificação',
      auth.uid(),
      jsonb_build_object('alteracoes', v_changes)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_produto_brasil_reclassificacao ON public.produtos_brasil;
CREATE TRIGGER trg_audit_produto_brasil_reclassificacao
AFTER UPDATE OF origem, status ON public.produtos_brasil
FOR EACH ROW
EXECUTE FUNCTION public.fn_audit_produto_brasil_reclassificacao();