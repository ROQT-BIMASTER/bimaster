
ALTER TABLE public.aprovacao_kanban_audit
  ADD COLUMN IF NOT EXISTS acao text NOT NULL DEFAULT 'movimento',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_kanban_audit_acao ON public.aprovacao_kanban_audit(item_id, acao);

CREATE OR REPLACE FUNCTION public.trg_kanban_audit_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_etapa_ant_ordem int;
  v_etapa_ant_nome text;
  v_etapa_nova_ordem int;
  v_etapa_nova_nome text;
  v_col_origem text;
  v_col_destino text;
  v_origem text;
  v_acao text;
  v_metadata jsonb;
BEGIN
  IF (NEW.status IS NOT DISTINCT FROM OLD.status)
     AND (NEW.etapa_atual_id IS NOT DISTINCT FROM OLD.etapa_atual_id)
     AND (NEW.responsavel_atual_id IS NOT DISTINCT FROM OLD.responsavel_atual_id) THEN
    RETURN NEW;
  END IF;

  SELECT ordem, nome INTO v_etapa_ant_ordem, v_etapa_ant_nome
    FROM public.fluxo_aprovacao_etapas WHERE id = OLD.etapa_atual_id;
  SELECT ordem, nome INTO v_etapa_nova_ordem, v_etapa_nova_nome
    FROM public.fluxo_aprovacao_etapas WHERE id = NEW.etapa_atual_id;

  v_col_origem := public._kanban_coluna_universal(OLD.status, v_etapa_ant_ordem);
  v_col_destino := public._kanban_coluna_universal(NEW.status, v_etapa_nova_ordem);

  v_origem := COALESCE(current_setting('app.kanban_audit_origem', true), 'sistema');
  v_acao := COALESCE(NULLIF(current_setting('app.kanban_audit_acao', true), ''), 'movimento');
  BEGIN
    v_metadata := COALESCE(NULLIF(current_setting('app.kanban_audit_metadata', true), ''), '{}')::jsonb;
  EXCEPTION WHEN others THEN
    v_metadata := '{}'::jsonb;
  END;

  INSERT INTO public.aprovacao_kanban_audit(
    item_id, user_id,
    coluna_origem, coluna_destino,
    status_anterior, status_novo,
    etapa_anterior_id, etapa_anterior_nome,
    etapa_atual_id, etapa_atual_nome,
    comentario, origem, acao, metadata
  ) VALUES (
    NEW.id, auth.uid(),
    v_col_origem, v_col_destino,
    OLD.status, NEW.status,
    OLD.etapa_atual_id, v_etapa_ant_nome,
    NEW.etapa_atual_id, v_etapa_nova_nome,
    NEW.comentario_atual, v_origem, v_acao, v_metadata
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_delegar_item_aprovacao(p_item_id uuid, p_para_user_id uuid, p_comentario text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_de_nome text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_item.status <> 'em_andamento' THEN RAISE EXCEPTION 'Item não está em andamento'; END IF;
  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Apenas o responsável atual pode delegar';
  END IF;
  IF p_para_user_id = v_uid THEN
    RAISE EXCEPTION 'Selecione outro membro para delegar';
  END IF;
  IF v_item.projeto_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.projeto_membros WHERE projeto_id = v_item.projeto_id AND user_id = p_para_user_id) THEN
    RAISE EXCEPTION 'Destinatário não é membro do projeto';
  END IF;

  PERFORM set_config('app.kanban_audit_origem', 'delegacao', true);
  PERFORM set_config('app.kanban_audit_acao', 'delegacao', true);
  PERFORM set_config('app.kanban_audit_metadata',
    jsonb_build_object('delegado_para', p_para_user_id, 'delegado_de', v_uid)::text, true);

  UPDATE public.aprovacao_documento_itens
     SET delegado_de = COALESCE(delegado_de, v_uid),
         delegado_em = now(),
         responsavel_atual_id = p_para_user_id,
         comentario_atual = COALESCE(p_comentario, comentario_atual),
         updated_at = now()
   WHERE id = p_item_id;

  PERFORM set_config('app.kanban_audit_origem', 'sistema', true);
  PERFORM set_config('app.kanban_audit_acao', 'movimento', true);
  PERFORM set_config('app.kanban_audit_metadata', '{}', true);

  SELECT COALESCE(full_name, email) INTO v_de_nome FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.notificacoes(user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
  VALUES (
    p_para_user_id,
    'Aprovação delegada para você',
    COALESCE(v_de_nome, 'Um colega') || ' delegou um item de aprovação' ||
      CASE WHEN p_comentario IS NOT NULL AND length(trim(p_comentario)) > 0
           THEN E'.\nObservação: ' || p_comentario
           ELSE '.' END,
    'aprovacao_delegada',
    p_item_id::text,
    'aprovacao_item'
  );
END $function$;

CREATE OR REPLACE FUNCTION public.rpc_revogar_oficializacao_cofre(p_item_id uuid, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_doc public.cofre_generico_documentos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  IF v_item.oficializado_em IS NULL OR v_item.oficializado_destino <> 'generico' THEN
    RAISE EXCEPTION 'Este item não está oficializado no Cofre Genérico';
  END IF;

  SELECT * INTO v_doc
    FROM public.cofre_generico_documentos
   WHERE origem_aprovacao_item_id = p_item_id AND revogado = false
   ORDER BY oficializado_em DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento oficial não encontrado';
  END IF;

  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR v_doc.oficializado_por = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para revogar esta oficialização';
  END IF;

  UPDATE public.cofre_generico_documentos
     SET revogado = true, revogado_em = now(), revogado_por = v_uid
   WHERE id = v_doc.id;

  UPDATE public.aprovacao_documento_itens
     SET oficializado_em = NULL,
         oficializado_destino = NULL,
         updated_at = now()
   WHERE id = p_item_id;

  INSERT INTO public.aprovacao_kanban_audit(
    item_id, user_id, comentario, origem, acao, metadata,
    status_anterior, status_novo
  ) VALUES (
    p_item_id, v_uid, p_motivo, 'oficializacao', 'revogacao_oficializacao',
    jsonb_build_object('documento_id', v_doc.id, 'destino', 'generico', 'motivo', p_motivo),
    v_item.status, v_item.status
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.rpc_revogar_oficializacao_cofre(uuid, text) TO authenticated;

-- definir prazo: drop+create para garantir nome do parâmetro
DROP FUNCTION IF EXISTS public.rpc_definir_prazo_item(uuid, timestamptz);
CREATE FUNCTION public.rpc_definir_prazo_item(p_item_id uuid, p_prazo_em timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  UPDATE public.aprovacao_documento_itens
     SET prazo_em = p_prazo_em, updated_at = now()
   WHERE id = p_item_id;

  INSERT INTO public.aprovacao_kanban_audit(
    item_id, user_id, origem, acao, metadata, status_anterior, status_novo
  ) VALUES (
    p_item_id, v_uid, 'sistema', 'prazo',
    jsonb_build_object('prazo_anterior', v_item.prazo_em, 'prazo_novo', p_prazo_em),
    v_item.status, v_item.status
  );
END $function$;

GRANT EXECUTE ON FUNCTION public.rpc_definir_prazo_item(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_kanban_audit_oficializacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.oficializado_em IS NULL AND NEW.oficializado_em IS NOT NULL) THEN
    INSERT INTO public.aprovacao_kanban_audit(
      item_id, user_id, origem, acao, metadata, status_anterior, status_novo
    ) VALUES (
      NEW.id, auth.uid(), 'oficializacao', 'oficializacao',
      jsonb_build_object('destino', NEW.oficializado_destino),
      OLD.status, NEW.status
    );
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_adi_audit_oficializacao ON public.aprovacao_documento_itens;
CREATE TRIGGER trg_adi_audit_oficializacao
  AFTER UPDATE OF oficializado_em ON public.aprovacao_documento_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_kanban_audit_oficializacao();
