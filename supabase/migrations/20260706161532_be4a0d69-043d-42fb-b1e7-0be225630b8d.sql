
-- =====================================================
-- SUPORTE PARECERES + TRILHA DE DEPARTAMENTOS
-- =====================================================

-- 1) suporte_pareceres
CREATE TABLE public.suporte_pareceres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  autor_id uuid NOT NULL,
  fila_id uuid REFERENCES public.suporte_filas(id),
  departamento_id uuid,
  visibilidade text NOT NULL DEFAULT 'interno' CHECK (visibilidade IN ('interno','externo')),
  tipo text NOT NULL DEFAULT 'parecer' CHECK (tipo IN ('parecer','orientacao','analise_tecnica','encaminhamento','conclusao')),
  titulo text,
  conteudo text NOT NULL,
  acao_tomada text,
  plano_correcao text,
  prazo_estimado timestamptz,
  status_departamento text NOT NULL DEFAULT 'em_analise' CHECK (status_departamento IN ('em_analise','concluido','encaminhado')),
  encaminhado_para_fila_id uuid REFERENCES public.suporte_filas(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sup_pareceres_ticket ON public.suporte_pareceres(ticket_id, created_at DESC);
CREATE INDEX idx_sup_pareceres_fila ON public.suporte_pareceres(fila_id);
CREATE INDEX idx_sup_pareceres_autor ON public.suporte_pareceres(autor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_pareceres TO authenticated;
GRANT ALL ON public.suporte_pareceres TO service_role;
ALTER TABLE public.suporte_pareceres ENABLE ROW LEVEL SECURITY;

-- SELECT: staff da fila do parecer OU staff geral OU autor OU (visibilidade=externo E requester/owner do ticket)
CREATE POLICY "sup_pareceres_sel" ON public.suporte_pareceres
  FOR SELECT TO authenticated
  USING (
    public.is_suporte_staff(auth.uid())
    OR public.is_agente_fila(auth.uid(), fila_id)
    OR autor_id = auth.uid()
    OR (
      visibilidade = 'externo'
      AND EXISTS (
        SELECT 1 FROM public.suporte_tickets t
        WHERE t.id = suporte_pareceres.ticket_id
          AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid())
      )
    )
  );

-- INSERT: staff geral OU agente da fila atual do ticket; autor_id obrigatório = auth.uid()
CREATE POLICY "sup_pareceres_ins" ON public.suporte_pareceres
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND (
      public.is_suporte_staff(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.suporte_tickets t
        WHERE t.id = suporte_pareceres.ticket_id
          AND public.is_agente_fila(auth.uid(), t.fila_id)
      )
    )
  );

-- UPDATE: autor até 15 min após criação, ou admin
CREATE POLICY "sup_pareceres_upd" ON public.suporte_pareceres
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (autor_id = auth.uid() AND created_at > now() - interval '15 minutes')
  );

-- DELETE: admin
CREATE POLICY "sup_pareceres_del" ON public.suporte_pareceres
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_sup_pareceres_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_sup_pareceres_updated
BEFORE UPDATE ON public.suporte_pareceres
FOR EACH ROW EXECUTE FUNCTION public.tg_sup_pareceres_updated();

-- =====================================================
-- 2) suporte_parecer_anexos
-- =====================================================
CREATE TABLE public.suporte_parecer_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parecer_id uuid NOT NULL REFERENCES public.suporte_pareceres(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome text NOT NULL,
  mime text,
  tamanho bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sup_parecer_anexos_parecer ON public.suporte_parecer_anexos(parecer_id);
CREATE INDEX idx_sup_parecer_anexos_ticket ON public.suporte_parecer_anexos(ticket_id);

GRANT SELECT, INSERT, DELETE ON public.suporte_parecer_anexos TO authenticated;
GRANT ALL ON public.suporte_parecer_anexos TO service_role;
ALTER TABLE public.suporte_parecer_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_parecer_anexos_sel" ON public.suporte_parecer_anexos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suporte_pareceres p
      WHERE p.id = suporte_parecer_anexos.parecer_id
        AND (
          public.is_suporte_staff(auth.uid())
          OR public.is_agente_fila(auth.uid(), p.fila_id)
          OR p.autor_id = auth.uid()
          OR (
            p.visibilidade = 'externo'
            AND EXISTS (
              SELECT 1 FROM public.suporte_tickets t
              WHERE t.id = p.ticket_id
                AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid())
            )
          )
        )
    )
  );

CREATE POLICY "sup_parecer_anexos_ins" ON public.suporte_parecer_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.suporte_pareceres p
      WHERE p.id = suporte_parecer_anexos.parecer_id
        AND p.autor_id = auth.uid()
    )
  );

CREATE POLICY "sup_parecer_anexos_del" ON public.suporte_parecer_anexos
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- =====================================================
-- 3) suporte_ticket_departamentos (trilha)
-- =====================================================
CREATE TABLE public.suporte_ticket_departamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.suporte_tickets(id) ON DELETE CASCADE,
  fila_id uuid REFERENCES public.suporte_filas(id),
  departamento_id uuid,
  entrou_em timestamptz NOT NULL DEFAULT now(),
  saiu_em timestamptz,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','transferido')),
  ultimo_parecer_id uuid REFERENCES public.suporte_pareceres(id) ON DELETE SET NULL,
  acao_resumo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sup_ticket_deptos_ticket ON public.suporte_ticket_departamentos(ticket_id, entrou_em);
CREATE INDEX idx_sup_ticket_deptos_ativos ON public.suporte_ticket_departamentos(ticket_id) WHERE status='ativo';

GRANT SELECT, INSERT, UPDATE ON public.suporte_ticket_departamentos TO authenticated;
GRANT ALL ON public.suporte_ticket_departamentos TO service_role;
ALTER TABLE public.suporte_ticket_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sup_tkt_dept_sel" ON public.suporte_ticket_departamentos
  FOR SELECT TO authenticated
  USING (
    public.is_suporte_staff(auth.uid())
    OR public.is_agente_fila(auth.uid(), fila_id)
    OR EXISTS (
      SELECT 1 FROM public.suporte_tickets t
      WHERE t.id = suporte_ticket_departamentos.ticket_id
        AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid())
    )
  );

-- Trigger: quando ticket é criado, abre depto inicial
CREATE OR REPLACE FUNCTION public.tg_sup_ticket_abre_depto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.fila_id IS NOT NULL THEN
    INSERT INTO public.suporte_ticket_departamentos (ticket_id, fila_id, status, entrou_em)
    VALUES (NEW.id, NEW.fila_id, 'ativo', now());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sup_ticket_abre_depto
AFTER INSERT ON public.suporte_tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_sup_ticket_abre_depto();

-- Trigger: quando ocorre transferência, fecha depto anterior e abre novo
CREATE OR REPLACE FUNCTION public.tg_sup_transf_atualiza_depto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  -- fecha o(s) departamento(s) ativo(s) do ticket
  UPDATE public.suporte_ticket_departamentos
     SET saiu_em = now(), status = 'transferido'
   WHERE ticket_id = NEW.ticket_id AND status = 'ativo';

  -- abre novo depto
  IF NEW.para_fila_id IS NOT NULL THEN
    INSERT INTO public.suporte_ticket_departamentos (ticket_id, fila_id, status, entrou_em)
    VALUES (NEW.ticket_id, NEW.para_fila_id, 'ativo', now());
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sup_transf_atualiza_depto
AFTER INSERT ON public.suporte_transferencias
FOR EACH ROW EXECUTE FUNCTION public.tg_sup_transf_atualiza_depto();

-- Trigger: quando ticket resolvido, fecha depto atual
CREATE OR REPLACE FUNCTION public.tg_sup_ticket_fecha_depto()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'resolvido' AND (OLD.status IS DISTINCT FROM 'resolvido') THEN
    UPDATE public.suporte_ticket_departamentos
       SET saiu_em = now(), status = 'concluido'
     WHERE ticket_id = NEW.id AND status = 'ativo';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sup_ticket_fecha_depto
AFTER UPDATE OF status ON public.suporte_tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_sup_ticket_fecha_depto();

-- =====================================================
-- 4) RPC: criar parecer (opcionalmente encaminhando)
-- =====================================================
CREATE OR REPLACE FUNCTION public.rpc_suporte_criar_parecer(
  p_ticket_id uuid,
  p_visibilidade text,
  p_tipo text,
  p_titulo text,
  p_conteudo text,
  p_acao_tomada text DEFAULT NULL,
  p_plano_correcao text DEFAULT NULL,
  p_prazo_estimado timestamptz DEFAULT NULL,
  p_encaminhar_para_fila_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_fila_id uuid;
  v_parecer_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT fila_id INTO v_fila_id FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF v_fila_id IS NULL AND NOT public.is_suporte_staff(v_uid) THEN
    RAISE EXCEPTION 'ticket_sem_fila';
  END IF;

  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  IF p_conteudo IS NULL OR btrim(p_conteudo) = '' THEN
    RAISE EXCEPTION 'conteudo_obrigatorio';
  END IF;

  INSERT INTO public.suporte_pareceres (
    ticket_id, autor_id, fila_id, visibilidade, tipo,
    titulo, conteudo, acao_tomada, plano_correcao, prazo_estimado,
    status_departamento, encaminhado_para_fila_id
  ) VALUES (
    p_ticket_id, v_uid, v_fila_id,
    COALESCE(p_visibilidade,'interno'),
    COALESCE(p_tipo,'parecer'),
    p_titulo, p_conteudo, p_acao_tomada, p_plano_correcao, p_prazo_estimado,
    CASE
      WHEN p_encaminhar_para_fila_id IS NOT NULL THEN 'encaminhado'
      WHEN p_tipo = 'conclusao' THEN 'concluido'
      ELSE 'em_analise'
    END,
    p_encaminhar_para_fila_id
  ) RETURNING id INTO v_parecer_id;

  -- vincula ao depto ativo mais recente
  UPDATE public.suporte_ticket_departamentos
     SET ultimo_parecer_id = v_parecer_id,
         acao_resumo = COALESCE(p_acao_tomada, acao_resumo)
   WHERE ticket_id = p_ticket_id AND status = 'ativo';

  -- encaminhamento: registra transferência (trigger cuida da trilha)
  IF p_encaminhar_para_fila_id IS NOT NULL AND p_encaminhar_para_fila_id <> v_fila_id THEN
    INSERT INTO public.suporte_transferencias (
      ticket_id, de_fila_id, para_fila_id, motivo, transferido_por
    ) VALUES (
      p_ticket_id, v_fila_id, p_encaminhar_para_fila_id,
      COALESCE(p_acao_tomada, 'Encaminhamento via parecer'),
      v_uid
    );
    UPDATE public.suporte_tickets
       SET fila_id = p_encaminhar_para_fila_id,
           assignee_id = NULL,
           updated_at = now()
     WHERE id = p_ticket_id;
  END IF;

  RETURN v_parecer_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.rpc_suporte_criar_parecer(uuid,text,text,text,text,text,text,timestamptz,uuid) TO authenticated;

-- =====================================================
-- 5) Backfill: abre depto para tickets já existentes que ainda não têm registro
-- =====================================================
INSERT INTO public.suporte_ticket_departamentos (ticket_id, fila_id, status, entrou_em)
SELECT t.id, t.fila_id,
       CASE WHEN t.status = 'resolvido' THEN 'concluido' ELSE 'ativo' END,
       t.created_at
  FROM public.suporte_tickets t
 WHERE t.fila_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.suporte_ticket_departamentos d
      WHERE d.ticket_id = t.id
   );

-- =====================================================
-- 6) Storage policies para bucket 'suporte-pareceres'
-- Path convention: <uid>/<ticket_id>/<file>
-- =====================================================
CREATE POLICY "sup_pareceres_storage_ins"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'suporte-pareceres'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "sup_pareceres_storage_own_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'suporte-pareceres'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_suporte_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.suporte_parecer_anexos a
       JOIN public.suporte_pareceres p ON p.id = a.parecer_id
       JOIN public.suporte_tickets t ON t.id = p.ticket_id
       WHERE a.storage_path = storage.objects.name
         AND (
           public.is_agente_fila(auth.uid(), p.fila_id)
           OR (p.visibilidade='externo' AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid()))
         )
    )
  )
);

CREATE POLICY "sup_pareceres_storage_del"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'suporte-pareceres'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
