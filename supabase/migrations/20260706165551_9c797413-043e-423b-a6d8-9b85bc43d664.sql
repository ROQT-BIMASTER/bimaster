
-- ============================================================
-- 1) TABLE: suporte_ticket_evidencias
-- ============================================================
CREATE TABLE public.suporte_ticket_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  parecer_id uuid REFERENCES public.suporte_pareceres(id) ON DELETE SET NULL,
  categoria text NOT NULL CHECK (categoria IN (
    'prova_juridica','contrato','email','print','audio','video','documento','outro'
  )),
  descricao text,
  storage_path text NOT NULL,
  nome_arquivo text NOT NULL,
  mime text,
  tamanho bigint,
  hash_sha256 text NOT NULL,
  uploaded_by uuid NOT NULL,
  locked_juridico boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sup_evid_ticket ON public.suporte_ticket_evidencias(ticket_id);
CREATE INDEX idx_sup_evid_parecer ON public.suporte_ticket_evidencias(parecer_id);
CREATE INDEX idx_sup_evid_categoria ON public.suporte_ticket_evidencias(categoria);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_ticket_evidencias TO authenticated;
GRANT ALL ON public.suporte_ticket_evidencias TO service_role;

ALTER TABLE public.suporte_ticket_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_evid_sel" ON public.suporte_ticket_evidencias
  FOR SELECT TO authenticated
  USING (
    public.is_suporte_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.suporte_tickets t
      WHERE t.id = suporte_ticket_evidencias.ticket_id
        AND (
          public.is_agente_fila(auth.uid(), t.fila_id)
          OR t.requester_id = auth.uid()
          OR t.owner_id = auth.uid()
        )
    )
  );

CREATE POLICY "sup_evid_ins" ON public.suporte_ticket_evidencias
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.is_suporte_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.suporte_tickets t
        WHERE t.id = suporte_ticket_evidencias.ticket_id
          AND (
            public.is_agente_fila(auth.uid(), t.fila_id)
            OR t.owner_id = auth.uid()
          )
      )
    )
  );

-- Só admin pode UPDATE (para bloquear/desbloquear e vincular/desvincular); nunca em travadas
CREATE POLICY "sup_evid_upd" ON public.suporte_ticket_evidencias
  FOR UPDATE TO authenticated
  USING (
    NOT locked_juridico
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (uploaded_by = auth.uid() AND created_at > now() - interval '15 minutes')
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR uploaded_by = auth.uid()
  );

-- DELETE: só admin e apenas se não travada
CREATE POLICY "sup_evid_del" ON public.suporte_ticket_evidencias
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND NOT locked_juridico
  );

-- Trigger updated_at
CREATE TRIGGER trg_sup_evid_updated
BEFORE UPDATE ON public.suporte_ticket_evidencias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger extra: bloquear qualquer UPDATE em coluna sensível se travada
CREATE OR REPLACE FUNCTION public.tg_sup_evid_lock_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked_juridico = true AND NEW.locked_juridico = false
     AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Evidência sob retenção jurídica não pode ser destravada';
  END IF;
  IF OLD.locked_juridico = true AND (
      OLD.storage_path IS DISTINCT FROM NEW.storage_path
      OR OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
      OR OLD.nome_arquivo IS DISTINCT FROM NEW.nome_arquivo
      OR OLD.categoria IS DISTINCT FROM NEW.categoria
  ) THEN
    RAISE EXCEPTION 'Evidência sob retenção jurídica é imutável';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sup_evid_lock_guard
BEFORE UPDATE ON public.suporte_ticket_evidencias
FOR EACH ROW EXECUTE FUNCTION public.tg_sup_evid_lock_guard();

-- ============================================================
-- 2) TABLE: suporte_evidencia_acessos (audit log imutável)
-- ============================================================
CREATE TABLE public.suporte_evidencia_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidencia_id uuid NOT NULL REFERENCES public.suporte_ticket_evidencias(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('download','view')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sup_evid_acc_evid ON public.suporte_evidencia_acessos(evidencia_id);
CREATE INDEX idx_sup_evid_acc_ticket ON public.suporte_evidencia_acessos(ticket_id);

GRANT SELECT, INSERT ON public.suporte_evidencia_acessos TO authenticated;
GRANT ALL ON public.suporte_evidencia_acessos TO service_role;

ALTER TABLE public.suporte_evidencia_acessos ENABLE ROW LEVEL SECURITY;

-- SELECT: staff/agentes da fila/admin
CREATE POLICY "sup_evid_acc_sel" ON public.suporte_evidencia_acessos
  FOR SELECT TO authenticated
  USING (
    public.is_suporte_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.suporte_tickets t
      WHERE t.id = suporte_evidencia_acessos.ticket_id
        AND public.is_agente_fila(auth.uid(), t.fila_id)
    )
  );

-- INSERT: qualquer autenticado que enxergue a evidência
CREATE POLICY "sup_evid_acc_ins" ON public.suporte_evidencia_acessos
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.suporte_ticket_evidencias e
      WHERE e.id = suporte_evidencia_acessos.evidencia_id
        AND e.ticket_id = suporte_evidencia_acessos.ticket_id
    )
  );

-- Sem UPDATE/DELETE policies -> imutável

-- ============================================================
-- 3) RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_suporte_criar_evidencia(
  p_ticket_id uuid,
  p_parecer_id uuid,
  p_categoria text,
  p_descricao text,
  p_storage_path text,
  p_nome_arquivo text,
  p_mime text,
  p_tamanho bigint,
  p_hash_sha256 text,
  p_marcar_como_prova boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fila_id uuid;
  v_owner uuid;
  v_id uuid;
  v_allowed boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT fila_id, owner_id INTO v_fila_id, v_owner
  FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chamado não encontrado';
  END IF;

  v_allowed :=
    public.is_suporte_staff(v_uid)
    OR public.is_agente_fila(v_uid, v_fila_id)
    OR v_owner = v_uid;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Sem permissão para anexar evidências neste chamado';
  END IF;

  INSERT INTO public.suporte_ticket_evidencias (
    ticket_id, parecer_id, categoria, descricao,
    storage_path, nome_arquivo, mime, tamanho, hash_sha256,
    uploaded_by, locked_juridico, locked_at, locked_by
  ) VALUES (
    p_ticket_id, p_parecer_id, p_categoria, p_descricao,
    p_storage_path, p_nome_arquivo, p_mime, p_tamanho, p_hash_sha256,
    v_uid,
    COALESCE(p_marcar_como_prova, false),
    CASE WHEN COALESCE(p_marcar_como_prova,false) THEN now() ELSE NULL END,
    CASE WHEN COALESCE(p_marcar_como_prova,false) THEN v_uid ELSE NULL END
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_criar_evidencia(uuid,uuid,text,text,text,text,text,bigint,text,boolean) TO authenticated;

-- Aplica legal hold (só admin)
CREATE OR REPLACE FUNCTION public.rpc_suporte_bloquear_evidencia(p_evidencia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Somente administradores podem aplicar retenção jurídica';
  END IF;
  UPDATE public.suporte_ticket_evidencias
     SET locked_juridico = true, locked_at = now(), locked_by = v_uid
   WHERE id = p_evidencia_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_bloquear_evidencia(uuid) TO authenticated;

-- Registra acesso (download/visualização)
CREATE OR REPLACE FUNCTION public.rpc_suporte_registrar_acesso_evidencia(
  p_evidencia_id uuid,
  p_acao text,
  p_user_agent text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT ticket_id INTO v_ticket_id
    FROM public.suporte_ticket_evidencias
   WHERE id = p_evidencia_id;
  IF v_ticket_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.suporte_evidencia_acessos (evidencia_id, ticket_id, user_id, acao, user_agent)
  VALUES (p_evidencia_id, v_ticket_id, v_uid, p_acao, p_user_agent);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_registrar_acesso_evidencia(uuid,text,text) TO authenticated;

-- ============================================================
-- 4) Storage RLS para bucket 'suporte-evidencias'
-- ============================================================
CREATE POLICY "suporte-evidencias-sel"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'suporte-evidencias'
    AND EXISTS (
      SELECT 1 FROM public.suporte_ticket_evidencias e
      JOIN public.suporte_tickets t ON t.id = e.ticket_id
      WHERE e.storage_path = storage.objects.name
        AND (
          public.is_suporte_staff(auth.uid())
          OR public.is_agente_fila(auth.uid(), t.fila_id)
          OR t.requester_id = auth.uid()
          OR t.owner_id = auth.uid()
        )
    )
  );

CREATE POLICY "suporte-evidencias-ins"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'suporte-evidencias'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "suporte-evidencias-del"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'suporte-evidencias'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
