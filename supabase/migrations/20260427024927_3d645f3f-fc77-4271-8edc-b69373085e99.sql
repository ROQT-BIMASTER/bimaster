-- ============================================================================
-- 1) LOG DE AUDITORIA DE EVIDÊNCIAS DE TAREFAS ESPELHADAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.processo_evidencia_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  espelho_id uuid NOT NULL REFERENCES public.processo_tarefa_espelho(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  projeto_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  acao text NOT NULL CHECK (acao IN ('vinculado','alterado','removido')),
  documento_anterior_id uuid,
  documento_novo_id uuid,
  observacao_anterior text,
  observacao_nova text,
  alterado_por uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pea_etapa ON public.processo_evidencia_audit(etapa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pea_espelho ON public.processo_evidencia_audit(espelho_id, created_at DESC);

ALTER TABLE public.processo_evidencia_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem audit de evidencias"
  ON public.processo_evidencia_audit FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/gerente gerenciam audit"
  ON public.processo_evidencia_audit FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

-- ============================================================================
-- 2) TRIGGER: registra audit ao alterar evidencia_documento_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_audit_evidencia_espelho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.evidencia_documento_id::text,'') IS DISTINCT FROM COALESCE(NEW.evidencia_documento_id::text,'')
       OR COALESCE(OLD.evidencia_observacao,'') IS DISTINCT FROM COALESCE(NEW.evidencia_observacao,'') THEN

      IF OLD.evidencia_documento_id IS NULL AND NEW.evidencia_documento_id IS NOT NULL THEN
        v_acao := 'vinculado';
      ELSIF OLD.evidencia_documento_id IS NOT NULL AND NEW.evidencia_documento_id IS NULL THEN
        v_acao := 'removido';
      ELSE
        v_acao := 'alterado';
      END IF;

      INSERT INTO public.processo_evidencia_audit(
        espelho_id, etapa_id, instancia_id, projeto_tarefa_id,
        acao, documento_anterior_id, documento_novo_id,
        observacao_anterior, observacao_nova, alterado_por
      ) VALUES (
        NEW.id, NEW.etapa_id, NEW.instancia_id, NEW.projeto_tarefa_id,
        v_acao, OLD.evidencia_documento_id, NEW.evidencia_documento_id,
        OLD.evidencia_observacao, NEW.evidencia_observacao, auth.uid()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_evidencia_espelho ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_audit_evidencia_espelho
  AFTER UPDATE ON public.processo_tarefa_espelho
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_audit_evidencia_espelho();

-- ============================================================================
-- 3) RPC: listar histórico de auditoria por etapa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.listar_audit_evidencias_etapa(p_etapa_id uuid)
RETURNS TABLE (
  id uuid,
  espelho_id uuid,
  acao text,
  tarefa_titulo text,
  projeto_nome text,
  documento_anterior_label text,
  documento_novo_label text,
  observacao_anterior text,
  observacao_nova text,
  alterado_por_nome text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.espelho_id,
    a.acao,
    t.titulo AS tarefa_titulo,
    p.nome   AS projeto_nome,
    COALESCE(da.label, da.tipo) AS documento_anterior_label,
    COALESCE(dn.label, dn.tipo) AS documento_novo_label,
    a.observacao_anterior,
    a.observacao_nova,
    COALESCE(pr.nome, pr.email) AS alterado_por_nome,
    a.created_at
  FROM public.processo_evidencia_audit a
  LEFT JOIN public.projeto_tarefas t ON t.id = a.projeto_tarefa_id
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  LEFT JOIN public.processo_etapa_documentos da ON da.id = a.documento_anterior_id
  LEFT JOIN public.processo_etapa_documentos dn ON dn.id = a.documento_novo_id
  LEFT JOIN public.profiles pr ON pr.id = a.alterado_por
  WHERE a.etapa_id = p_etapa_id
  ORDER BY a.created_at DESC;
$$;

-- ============================================================================
-- 4) NOTIFICAÇÃO ao responsável quando há tarefa-espelho pendente sem documento
--    Trigger ao INSERT em processo_tarefa_espelho (criação do vínculo)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_notify_responsavel_espelho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_responsavel uuid;
  v_titulo text;
  v_projeto text;
BEGIN
  IF NEW.projeto_tarefa_id IS NULL OR NEW.exige_documentos = false THEN
    RETURN NEW;
  END IF;

  SELECT t.responsavel_id, t.titulo, p.nome
    INTO v_responsavel, v_titulo, v_projeto
  FROM public.projeto_tarefas t
  LEFT JOIN public.projetos p ON p.id = t.projeto_id
  WHERE t.id = NEW.projeto_tarefa_id;

  IF v_responsavel IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, action_url)
  VALUES (
    v_responsavel,
    'task_assigned',
    'Tarefa vinculada a um processo',
    'A tarefa "' || COALESCE(v_titulo,'(sem título)') || '" do projeto ' || COALESCE(v_projeto,'') ||
      ' está vinculada a uma etapa do processo. Será necessário selecionar um documento oficial ao concluir.',
    '/dashboard/projetos'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_responsavel_espelho ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_notify_responsavel_espelho
  AFTER INSERT ON public.processo_tarefa_espelho
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_responsavel_espelho();

-- ============================================================================
-- 5) Função utilitária: notificar responsáveis com tarefas pendentes
--    (pode ser chamada por cron/edge function diariamente)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notificar_espelhos_pendentes_sem_doc()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  r record;
BEGIN
  FOR r IN
    SELECT e.id, e.projeto_tarefa_id, t.responsavel_id, t.titulo, p.nome AS projeto_nome
    FROM public.processo_tarefa_espelho e
    JOIN public.projeto_tarefas t ON t.id = e.projeto_tarefa_id
    LEFT JOIN public.projetos p ON p.id = t.projeto_id
    WHERE e.status <> 'concluida'
      AND e.exige_documentos = true
      AND e.evidencia_documento_id IS NULL
      AND t.responsavel_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = t.responsavel_id
          AND n.type = 'task_assigned'
          AND n.created_at > now() - interval '24 hours'
          AND n.message LIKE '%' || t.titulo || '%'
      )
  LOOP
    INSERT INTO public.notifications(user_id, type, title, message, action_url)
    VALUES (
      r.responsavel_id,
      'task_assigned',
      'Documento oficial pendente',
      'A tarefa "' || COALESCE(r.titulo,'(sem título)') || '" do projeto ' || COALESCE(r.projeto_nome,'') ||
        ' está vinculada a um processo e ainda precisa de um documento oficial para ser concluída.',
      '/dashboard/projetos'
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;