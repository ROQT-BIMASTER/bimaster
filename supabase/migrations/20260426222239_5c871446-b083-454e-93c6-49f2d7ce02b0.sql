
-- Trigger function: registrar atividade na tarefa quando documento China é vinculado/desvinculado
CREATE OR REPLACE FUNCTION public.fn_log_china_doc_vinculo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_nome text;
  v_doc_tipo text;
  v_user_id uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT nome_arquivo, tipo_documento
      INTO v_doc_nome, v_doc_tipo
    FROM public.china_produto_documentos
    WHERE id = NEW.documento_id;

    v_user_id := COALESCE(NEW.created_by, auth.uid());

    INSERT INTO public.projeto_tarefa_atividades (
      tarefa_id, projeto_id, user_id, tipo, campo, valor_novo, descricao
    ) VALUES (
      NEW.tarefa_id,
      NEW.projeto_id,
      v_user_id,
      'documento_china_vinculado',
      'documento_china',
      v_doc_tipo,
      'Anexou documento da China: ' || COALESCE(v_doc_nome, v_doc_tipo, 'documento')
    );
    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    SELECT nome_arquivo, tipo_documento
      INTO v_doc_nome, v_doc_tipo
    FROM public.china_produto_documentos
    WHERE id = OLD.documento_id;

    INSERT INTO public.projeto_tarefa_atividades (
      tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, descricao
    ) VALUES (
      OLD.tarefa_id,
      OLD.projeto_id,
      auth.uid(),
      'documento_china_desvinculado',
      'documento_china',
      v_doc_tipo,
      'Removeu documento da China: ' || COALESCE(v_doc_nome, v_doc_tipo, 'documento')
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Não bloquear vínculo se o log falhar
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_log_china_doc_vinculo_ins ON public.china_documento_tarefa_vinculos;
CREATE TRIGGER trg_log_china_doc_vinculo_ins
AFTER INSERT ON public.china_documento_tarefa_vinculos
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_china_doc_vinculo();

DROP TRIGGER IF EXISTS trg_log_china_doc_vinculo_del ON public.china_documento_tarefa_vinculos;
CREATE TRIGGER trg_log_china_doc_vinculo_del
AFTER DELETE ON public.china_documento_tarefa_vinculos
FOR EACH ROW
EXECUTE FUNCTION public.fn_log_china_doc_vinculo();
