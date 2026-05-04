
-- Função auxiliar: mapeia status + ordem da etapa para a coluna universal
CREATE OR REPLACE FUNCTION public._kanban_coluna_universal(
  p_status text,
  p_etapa_ordem int
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IN ('aprovado','encaminhado') THEN 'aprovado'
    WHEN p_status IN ('rejeitado','cancelado') THEN 'rejeitado'
    WHEN p_status = 'em_andamento' AND COALESCE(p_etapa_ordem,1) <= 1 THEN 'em_analise'
    WHEN p_status = 'em_andamento' THEN 'em_revisao'
    ELSE 'em_analise'
  END
$$;

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS public.aprovacao_kanban_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.aprovacao_documento_itens(id) ON DELETE CASCADE,
  user_id uuid,
  coluna_origem text,
  coluna_destino text,
  status_anterior text,
  status_novo text,
  etapa_anterior_id uuid,
  etapa_anterior_nome text,
  etapa_atual_id uuid,
  etapa_atual_nome text,
  comentario text,
  origem text NOT NULL DEFAULT 'sistema',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kanban_audit_item ON public.aprovacao_kanban_audit(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kanban_audit_user ON public.aprovacao_kanban_audit(user_id, created_at DESC);

ALTER TABLE public.aprovacao_kanban_audit ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário é criador/responsável do item OU membro do projeto do item
DROP POLICY IF EXISTS "audit_select_visivel" ON public.aprovacao_kanban_audit;
CREATE POLICY "audit_select_visivel" ON public.aprovacao_kanban_audit
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.aprovacao_documento_itens i
    WHERE i.id = aprovacao_kanban_audit.item_id
      AND (
        i.created_by = auth.uid()
        OR i.responsavel_atual_id = auth.uid()
        OR i.projeto_id IN (
          SELECT pm.projeto_id FROM public.projeto_membros pm WHERE pm.user_id = auth.uid()
        )
      )
  )
);

-- Sem insert/update/delete pelo cliente (apenas via trigger SECURITY DEFINER)
-- (sem POLICY de INSERT/UPDATE/DELETE = bloqueado)

-- Trigger: registra auditoria após mudança de status/etapa/responsável
CREATE OR REPLACE FUNCTION public.trg_kanban_audit_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_etapa_ant_ordem int;
  v_etapa_ant_nome text;
  v_etapa_nova_ordem int;
  v_etapa_nova_nome text;
  v_col_origem text;
  v_col_destino text;
  v_origem text;
BEGIN
  -- só registra se algo relevante mudou
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

  INSERT INTO public.aprovacao_kanban_audit(
    item_id, user_id,
    coluna_origem, coluna_destino,
    status_anterior, status_novo,
    etapa_anterior_id, etapa_anterior_nome,
    etapa_atual_id, etapa_atual_nome,
    comentario, origem
  ) VALUES (
    NEW.id, auth.uid(),
    v_col_origem, v_col_destino,
    OLD.status, NEW.status,
    OLD.etapa_atual_id, v_etapa_ant_nome,
    NEW.etapa_atual_id, v_etapa_nova_nome,
    NEW.comentario_atual, v_origem
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aprovacao_itens_audit_movimento ON public.aprovacao_documento_itens;
CREATE TRIGGER aprovacao_itens_audit_movimento
AFTER UPDATE ON public.aprovacao_documento_itens
FOR EACH ROW
EXECUTE FUNCTION public.trg_kanban_audit_movimento();

-- Atualiza rpc_mover_item_coluna para marcar a origem da movimentação
CREATE OR REPLACE FUNCTION public.rpc_mover_item_coluna(
  p_item_id uuid,
  p_coluna text,
  p_comentario text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.kanban_audit_origem', 'drag', true);

  IF p_coluna = 'aprovado' THEN
    PERFORM public.rpc_avancar_item_aprovacao(p_item_id, 'aprovado'::text, p_comentario);
  ELSIF p_coluna = 'rejeitado' THEN
    PERFORM public.rpc_avancar_item_aprovacao(p_item_id, 'rejeitado'::text, p_comentario);
  ELSIF p_coluna = 'em_revisao' THEN
    PERFORM public.rpc_solicitar_revisao_item(p_item_id, p_comentario);
  ELSE
    RAISE EXCEPTION 'coluna % não suporta drag-and-drop', p_coluna;
  END IF;

  PERFORM set_config('app.kanban_audit_origem', 'sistema', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_mover_item_coluna(uuid, text, text) TO authenticated;
