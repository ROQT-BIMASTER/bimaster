
-- =========================================================
-- suporte_views — visualizações salvas de tickets (pessoais e por fila)
-- =========================================================
CREATE TABLE public.suporte_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  escopo text NOT NULL CHECK (escopo IN ('pessoal', 'fila')),
  fila_id uuid REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  colunas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordenacao jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suporte_views_fila_obrigatoria_se_compartilhada
    CHECK ((escopo = 'fila' AND fila_id IS NOT NULL) OR (escopo = 'pessoal'))
);

CREATE INDEX suporte_views_owner_idx ON public.suporte_views(owner_id);
CREATE INDEX suporte_views_fila_idx ON public.suporte_views(fila_id) WHERE fila_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_views TO authenticated;
GRANT ALL ON public.suporte_views TO service_role;

ALTER TABLE public.suporte_views ENABLE ROW LEVEL SECURITY;

-- Owner vê e gerencia suas próprias views (pessoais e as compartilhadas que criou).
CREATE POLICY "Owner gerencia próprias views"
  ON public.suporte_views
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Agentes ativos da fila leem views compartilhadas daquela fila.
CREATE POLICY "Agentes leem views da fila"
  ON public.suporte_views
  FOR SELECT
  TO authenticated
  USING (
    escopo = 'fila'
    AND fila_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.suporte_fila_agentes a
      WHERE a.fila_id = suporte_views.fila_id
        AND a.user_id = auth.uid()
        AND a.ativo = true
    )
  );

-- Admin/supervisor lê tudo (para gerenciar).
CREATE POLICY "Admin/supervisor lê todas views"
  ON public.suporte_views
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'supervisor')
  );

-- Trigger de updated_at
CREATE TRIGGER suporte_views_set_updated_at
  BEFORE UPDATE ON public.suporte_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RPC: rpc_suporte_bulk_update — ações em lote
-- =========================================================
CREATE OR REPLACE FUNCTION public.rpc_suporte_bulk_update(
  p_ticket_ids uuid[],
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_priv boolean;
  v_ticket record;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_new_assignee uuid;
  v_new_fila uuid;
  v_new_status text;
  v_new_prioridade text;
  v_can boolean;
  v_valid_status text[] := ARRAY['novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido'];
  v_valid_prio text[] := ARRAY['baixa','media','alta','critica'];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_ticket_ids IS NULL OR array_length(p_ticket_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('updated', 0, 'errors', '[]'::jsonb);
  END IF;

  IF array_length(p_ticket_ids, 1) > 500 THEN
    RAISE EXCEPTION 'bulk_limit_exceeded_max_500';
  END IF;

  -- Whitelist de campos
  v_new_assignee   := NULLIF(p_patch->>'assignee_id','')::uuid;
  v_new_fila       := NULLIF(p_patch->>'fila_id','')::uuid;
  v_new_status     := NULLIF(p_patch->>'status','');
  v_new_prioridade := NULLIF(p_patch->>'prioridade','');

  IF v_new_status IS NOT NULL AND NOT (v_new_status = ANY(v_valid_status)) THEN
    RAISE EXCEPTION 'invalid_status:%', v_new_status;
  END IF;
  IF v_new_prioridade IS NOT NULL AND NOT (v_new_prioridade = ANY(v_valid_prio)) THEN
    RAISE EXCEPTION 'invalid_prioridade:%', v_new_prioridade;
  END IF;

  v_is_priv := public.has_role(v_user, 'admin') OR public.has_role(v_user, 'supervisor');

  FOR v_ticket IN
    SELECT * FROM public.suporte_tickets WHERE id = ANY(p_ticket_ids)
  LOOP
    -- Autorização por ticket: admin/sup, ou membro da fila de origem, ou membro da fila destino (transferência)
    v_can := v_is_priv;
    IF NOT v_can THEN
      v_can := EXISTS (
        SELECT 1 FROM public.suporte_fila_agentes a
        WHERE a.user_id = v_user AND a.ativo = true
          AND (a.fila_id = v_ticket.fila_id
               OR (v_new_fila IS NOT NULL AND a.fila_id = v_new_fila))
      );
    END IF;

    IF NOT v_can THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'ticket_id', v_ticket.id,
        'motivo', 'forbidden'
      ));
      CONTINUE;
    END IF;

    -- Aplicar patch
    UPDATE public.suporte_tickets
       SET assignee_id = COALESCE(v_new_assignee, assignee_id),
           fila_id     = COALESCE(v_new_fila, fila_id),
           status      = COALESCE(v_new_status, status),
           prioridade  = COALESCE(v_new_prioridade, prioridade),
           resolved_at = CASE
                           WHEN v_new_status = 'resolvido' AND resolved_at IS NULL THEN now()
                           WHEN v_new_status IS NOT NULL AND v_new_status <> 'resolvido' THEN NULL
                           ELSE resolved_at
                         END,
           ultima_interacao_em = now(),
           updated_at = now()
     WHERE id = v_ticket.id;

    v_updated := v_updated + 1;

    -- Auditoria
    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
    VALUES (v_ticket.id, 'bulk_update', jsonb_build_object(
      'by', v_user,
      'patch', p_patch,
      'antes', jsonb_build_object(
        'assignee_id', v_ticket.assignee_id,
        'fila_id',     v_ticket.fila_id,
        'status',      v_ticket.status,
        'prioridade',  v_ticket.prioridade
      )
    ));

    -- Transferência entre filas
    IF v_new_fila IS NOT NULL AND v_new_fila <> v_ticket.fila_id THEN
      INSERT INTO public.suporte_transferencias
        (ticket_id, de_fila_id, para_fila_id, de_assignee_id, para_assignee_id, motivo, via_ia, transferido_por)
      VALUES
        (v_ticket.id, v_ticket.fila_id, v_new_fila, v_ticket.assignee_id, v_new_assignee, 'bulk_update', false, v_user);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'errors', v_errors);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_suporte_bulk_update(uuid[], jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_suporte_bulk_update(uuid[], jsonb) TO authenticated;
