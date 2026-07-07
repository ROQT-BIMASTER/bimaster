
-- ==========================================================
-- Fase 6: alertas de handoff cross-departamento
-- ==========================================================

CREATE TYPE public.processo_handoff_alerta_tipo AS ENUM ('origem_atrasada','handoff_estourado');

CREATE TABLE public.processo_handoff_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos_operacionais(id) ON DELETE CASCADE,
  ligacao_id uuid NOT NULL REFERENCES public.processo_ligacoes(id) ON DELETE CASCADE,
  de_etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  para_etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  data_ref date NOT NULL,
  tipo public.processo_handoff_alerta_tipo NOT NULL,
  minutos_atraso integer,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  escalado_em timestamptz,
  escalado_para uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ligacao_id, data_ref, tipo)
);
CREATE INDEX processo_handoff_alertas_processo_idx ON public.processo_handoff_alertas(processo_id, data_ref);
CREATE INDEX processo_handoff_alertas_abertos_idx ON public.processo_handoff_alertas(resolvido_em) WHERE resolvido_em IS NULL;

GRANT SELECT, UPDATE ON public.processo_handoff_alertas TO authenticated;
GRANT ALL ON public.processo_handoff_alertas TO service_role;
ALTER TABLE public.processo_handoff_alertas ENABLE ROW LEVEL SECURITY;

-- Visualiza quem está envolvido no processo (mesma regra das outras tabelas de processos).
CREATE POLICY "processo_handoff_alertas_select" ON public.processo_handoff_alertas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.processos_operacionais po
      JOIN public.suporte_filas sf ON sf.id = po.fila_dona_id
      LEFT JOIN public.suporte_fila_agentes sfa
        ON sfa.fila_id = sf.id AND sfa.user_id = auth.uid() AND sfa.ativo = true
      WHERE po.id = processo_handoff_alertas.processo_id
        AND (sfa.user_id IS NOT NULL OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Só líderes e admins podem marcar como resolvido/escalado manualmente.
CREATE POLICY "processo_handoff_alertas_update_lider" ON public.processo_handoff_alertas
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.processos_operacionais po
      JOIN public.suporte_fila_agentes sfa
        ON sfa.fila_id = po.fila_dona_id
      WHERE po.id = processo_handoff_alertas.processo_id
        AND sfa.user_id = auth.uid()
        AND sfa.ativo = true
        AND sfa.papel IN ('lider','supervisor')
    )
  );

CREATE TRIGGER trg_processo_handoff_alertas_updated_at
  BEFORE UPDATE ON public.processo_handoff_alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================
-- Função de varredura: gera novos alertas + resolve os antigos
-- ==========================================================
CREATE OR REPLACE FUNCTION public.rpc_processo_gerar_alertas_handoff(
  _data_ref date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (novos integer, resolvidos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novos integer := 0;
  v_resolvidos integer := 0;
  r record;
  v_alerta_id uuid;
  v_line_leader uuid;
BEGIN
  -- Snapshot: por ligação, estado da origem e destino no dia
  FOR r IN
    SELECT pl.id AS ligacao_id, pl.processo_id, pl.de_etapa_id, pl.para_etapa_id,
           pl.sla_handoff_minutos,
           rf_origem.id AS rotina_origem_id,
           rf_origem.responsavel_user_id AS origem_responsavel,
           rf_origem.fila_id AS origem_fila_id,
           rf_destino.id AS rotina_destino_id,
           rf_destino.responsavel_user_id AS destino_responsavel,
           rf_destino.fila_id AS destino_fila_id,
           sre_origem.sla_deadline AS origem_deadline,
           sre_origem.concluida_em AS origem_concluida_em,
           sre_destino.concluida_em AS destino_concluida_em,
           sre_destino.status AS destino_status
    FROM public.processo_ligacoes pl
    JOIN public.processos_operacionais po ON po.id = pl.processo_id AND po.ativo = true
    JOIN public.processo_etapas pe_origem ON pe_origem.id = pl.de_etapa_id
    JOIN public.processo_etapas pe_destino ON pe_destino.id = pl.para_etapa_id
    JOIN public.suporte_rotinas_fixas rf_origem ON rf_origem.id = pe_origem.rotina_fixa_id
    JOIN public.suporte_rotinas_fixas rf_destino ON rf_destino.id = pe_destino.rotina_fixa_id
    LEFT JOIN public.suporte_rotina_execucoes sre_origem
      ON sre_origem.rotina_id = rf_origem.id AND sre_origem.data_referencia = _data_ref
    LEFT JOIN public.suporte_rotina_execucoes sre_destino
      ON sre_destino.rotina_id = rf_destino.id AND sre_destino.data_referencia = _data_ref
  LOOP
    -- 1) origem_atrasada: origem com deadline estourado e ainda não concluída, e destino também pendente
    IF r.origem_concluida_em IS NULL
       AND r.origem_deadline IS NOT NULL
       AND r.origem_deadline < now()
       AND r.destino_concluida_em IS NULL
    THEN
      INSERT INTO public.processo_handoff_alertas
        (processo_id, ligacao_id, de_etapa_id, para_etapa_id, data_ref, tipo, minutos_atraso)
      VALUES
        (r.processo_id, r.ligacao_id, r.de_etapa_id, r.para_etapa_id, _data_ref,
         'origem_atrasada'::public.processo_handoff_alerta_tipo,
         GREATEST(0, EXTRACT(EPOCH FROM (now() - r.origem_deadline))::int / 60))
      ON CONFLICT (ligacao_id, data_ref, tipo) DO UPDATE
        SET minutos_atraso = EXCLUDED.minutos_atraso,
            updated_at = now()
      RETURNING id INTO v_alerta_id;

      IF v_alerta_id IS NOT NULL THEN
        v_novos := v_novos + 1;
      END IF;

    ELSIF r.origem_concluida_em IS NOT NULL
          AND r.destino_concluida_em IS NULL
          AND (r.destino_status IS NULL OR r.destino_status IN ('gerada'))
          AND r.sla_handoff_minutos IS NOT NULL
          AND now() > (r.origem_concluida_em + make_interval(mins => r.sla_handoff_minutos))
    THEN
      -- 2) handoff_estourado: origem já concluída mas destino ainda não iniciada além do SLA de handoff
      INSERT INTO public.processo_handoff_alertas
        (processo_id, ligacao_id, de_etapa_id, para_etapa_id, data_ref, tipo, minutos_atraso)
      VALUES
        (r.processo_id, r.ligacao_id, r.de_etapa_id, r.para_etapa_id, _data_ref,
         'handoff_estourado'::public.processo_handoff_alerta_tipo,
         GREATEST(0, EXTRACT(EPOCH FROM (now() - (r.origem_concluida_em + make_interval(mins => r.sla_handoff_minutos))))::int / 60))
      ON CONFLICT (ligacao_id, data_ref, tipo) DO UPDATE
        SET minutos_atraso = EXCLUDED.minutos_atraso,
            updated_at = now()
      RETURNING id INTO v_alerta_id;

      IF v_alerta_id IS NOT NULL THEN
        v_novos := v_novos + 1;
      END IF;

    ELSE
      -- Nenhuma condição de breach → resolve alertas antigos desta ligação/dia
      UPDATE public.processo_handoff_alertas
        SET resolvido_em = now()
        WHERE ligacao_id = r.ligacao_id
          AND data_ref = _data_ref
          AND resolvido_em IS NULL;
      IF FOUND THEN
        v_resolvidos := v_resolvidos + 1;
      END IF;
    END IF;
  END LOOP;

  -- Notifica responsáveis e líderes por alertas ainda sem notificação disparada
  FOR r IN
    SELECT a.id, a.processo_id, a.tipo, a.minutos_atraso,
           po.nome AS processo_nome,
           rf_origem.titulo AS origem_titulo,
           rf_origem.responsavel_user_id AS origem_responsavel,
           rf_origem.fila_id AS origem_fila_id,
           rf_destino.titulo AS destino_titulo,
           rf_destino.responsavel_user_id AS destino_responsavel,
           rf_destino.fila_id AS destino_fila_id
    FROM public.processo_handoff_alertas a
    JOIN public.processos_operacionais po ON po.id = a.processo_id
    JOIN public.processo_etapas pe_o ON pe_o.id = a.de_etapa_id
    JOIN public.processo_etapas pe_d ON pe_d.id = a.para_etapa_id
    JOIN public.suporte_rotinas_fixas rf_origem ON rf_origem.id = pe_o.rotina_fixa_id
    JOIN public.suporte_rotinas_fixas rf_destino ON rf_destino.id = pe_d.rotina_fixa_id
    WHERE a.data_ref = _data_ref
      AND a.resolvido_em IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notificacoes n
        WHERE n.referencia_id = a.id::text
          AND n.referencia_tipo = 'processo_handoff_alerta'
      )
  LOOP
    -- Responsáveis diretos
    IF r.origem_responsavel IS NOT NULL THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
      VALUES (r.origem_responsavel,
              'Handoff em risco: ' || r.processo_nome,
              CASE r.tipo
                WHEN 'origem_atrasada' THEN 'Sua etapa "' || r.origem_titulo || '" está atrasada em ' || COALESCE(r.minutos_atraso::text,'?') || ' min e bloqueia "' || r.destino_titulo || '".'
                ELSE 'Você concluiu "' || r.origem_titulo || '", mas o handoff para "' || r.destino_titulo || '" já passou do prazo em ' || COALESCE(r.minutos_atraso::text,'?') || ' min.'
              END,
              'processo_handoff',
              r.id::text, 'processo_handoff_alerta');
    END IF;

    IF r.destino_responsavel IS NOT NULL AND r.destino_responsavel IS DISTINCT FROM r.origem_responsavel THEN
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
      VALUES (r.destino_responsavel,
              'Handoff em risco: ' || r.processo_nome,
              'A etapa "' || r.destino_titulo || '" depende de "' || r.origem_titulo || '" e está em atraso (' || COALESCE(r.minutos_atraso::text,'?') || ' min).',
              'processo_handoff',
              r.id::text, 'processo_handoff_alerta');
    END IF;

    -- Líderes das filas envolvidas
    FOR v_line_leader IN
      SELECT DISTINCT sfa.user_id
      FROM public.suporte_fila_agentes sfa
      WHERE sfa.fila_id IN (r.origem_fila_id, r.destino_fila_id)
        AND sfa.ativo = true
        AND sfa.papel IN ('lider','supervisor')
        AND sfa.user_id IS NOT NULL
        AND sfa.user_id IS DISTINCT FROM r.origem_responsavel
        AND sfa.user_id IS DISTINCT FROM r.destino_responsavel
    LOOP
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
      VALUES (v_line_leader,
              'Handoff em risco: ' || r.processo_nome,
              'Bloqueio entre "' || r.origem_titulo || '" e "' || r.destino_titulo || '" (atraso ' || COALESCE(r.minutos_atraso::text,'?') || ' min).',
              'processo_handoff',
              r.id::text, 'processo_handoff_alerta');
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_novos, v_resolvidos;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_processo_gerar_alertas_handoff(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_processo_gerar_alertas_handoff(date) TO authenticated, service_role;

-- ==========================================================
-- Escalonamento manual (líder marca "escalado" e notifica admins da fila destino)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.rpc_processo_escalar_alerta(_alerta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerta record;
  v_user uuid;
BEGIN
  SELECT a.*, po.nome AS processo_nome,
         rf_d.fila_id AS destino_fila_id,
         rf_d.titulo AS destino_titulo,
         rf_o.titulo AS origem_titulo
    INTO v_alerta
    FROM public.processo_handoff_alertas a
    JOIN public.processos_operacionais po ON po.id = a.processo_id
    JOIN public.processo_etapas pe_d ON pe_d.id = a.para_etapa_id
    JOIN public.processo_etapas pe_o ON pe_o.id = a.de_etapa_id
    JOIN public.suporte_rotinas_fixas rf_d ON rf_d.id = pe_d.rotina_fixa_id
    JOIN public.suporte_rotinas_fixas rf_o ON rf_o.id = pe_o.rotina_fixa_id
    WHERE a.id = _alerta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Alerta não encontrado';
  END IF;

  UPDATE public.processo_handoff_alertas
    SET escalado_em = now(),
        escalado_para = auth.uid()
    WHERE id = _alerta_id;

  FOR v_user IN
    SELECT DISTINCT sfa.user_id
    FROM public.suporte_fila_agentes sfa
    WHERE sfa.fila_id = v_alerta.destino_fila_id
      AND sfa.ativo = true
      AND sfa.papel IN ('lider','supervisor')
      AND sfa.user_id IS NOT NULL
  LOOP
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
    VALUES (v_user,
            'Escalonamento de processo: ' || v_alerta.processo_nome,
            'Alerta escalado por líder. Bloqueio entre "' || v_alerta.origem_titulo || '" e "' || v_alerta.destino_titulo || '".',
            'processo_handoff_escalado',
            _alerta_id::text, 'processo_handoff_alerta');
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_processo_escalar_alerta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_processo_escalar_alerta(uuid) TO authenticated, service_role;

-- ==========================================================
-- Agendamento pg_cron a cada 10 minutos
-- ==========================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('processo_alertas_handoff_10min')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'processo_alertas_handoff_10min');
    PERFORM cron.schedule(
      'processo_alertas_handoff_10min',
      '*/10 * * * *',
      $cmd$SELECT public.rpc_processo_gerar_alertas_handoff();$cmd$
    );
  END IF;
END $$;
