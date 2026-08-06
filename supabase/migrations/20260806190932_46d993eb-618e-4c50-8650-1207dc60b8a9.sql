-- ─── Recorrência de eventos do calendário ───
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_recorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tarefa_base_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  frequencia text NOT NULL CHECK (frequencia IN ('semanal','mensal')),
  intervalo integer NOT NULL DEFAULT 1 CHECK (intervalo BETWEEN 1 AND 12),
  ate_data date,
  ativa boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_tarefa_recorrencias TO authenticated;
GRANT ALL ON public.projeto_tarefa_recorrencias TO service_role;
ALTER TABLE public.projeto_tarefa_recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view recorrencias" ON public.projeto_tarefa_recorrencias
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto((SELECT auth.uid()), projeto_id) OR criado_por = (SELECT auth.uid()));
CREATE POLICY "Members can manage recorrencias" ON public.projeto_tarefa_recorrencias
  FOR ALL TO authenticated
  USING (public.user_can_access_projeto((SELECT auth.uid()), projeto_id) OR criado_por = (SELECT auth.uid()))
  WITH CHECK (public.user_can_access_projeto((SELECT auth.uid()), projeto_id) OR criado_por = (SELECT auth.uid()));

ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS recorrencia_id uuid REFERENCES public.projeto_tarefa_recorrencias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ocorrencia_data date;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_recorrencia ON public.projeto_tarefas(recorrencia_id) WHERE recorrencia_id IS NOT NULL;

-- ─── Lembretes de calendário ───
CREATE TABLE IF NOT EXISTS public.calendario_lembretes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  projeto_id uuid,
  user_id uuid NOT NULL,
  antecedencia_minutos integer NOT NULL DEFAULT 1440 CHECK (antecedencia_minutos > 0 AND antecedencia_minutos <= 43200),
  canal_email boolean NOT NULL DEFAULT true,
  canal_notificacao boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_envio_para date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_lembretes TO authenticated;
GRANT ALL ON public.calendario_lembretes TO service_role;
ALTER TABLE public.calendario_lembretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lembretes" ON public.calendario_lembretes
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_calendario_lembretes_ativo ON public.calendario_lembretes(ativo, tarefa_id);

CREATE TRIGGER trg_recorrencias_updated_at BEFORE UPDATE ON public.projeto_tarefa_recorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_calendario_lembretes_updated_at BEFORE UPDATE ON public.calendario_lembretes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── RPCs ───
CREATE OR REPLACE FUNCTION public.rpc_criar_evento_recorrente(
  p_tarefa_id uuid,
  p_frequencia text,
  p_intervalo integer DEFAULT 1,
  p_ate date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t record; v_rec uuid; v_ini date; v_fim date; v_dur integer;
  v_lim date; v_i integer := 1; v_max integer := 60; v_int integer; d date;
BEGIN
  SELECT * INTO v_t FROM projeto_tarefas WHERE id = p_tarefa_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  IF NOT (public.user_can_access_projeto(auth.uid(), v_t.projeto_id)
          OR v_t.criador_id = auth.uid() OR v_t.responsavel_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para criar recorrência nesta tarefa';
  END IF;
  IF p_frequencia NOT IN ('semanal','mensal') THEN RAISE EXCEPTION 'Frequência inválida'; END IF;

  v_int := GREATEST(COALESCE(p_intervalo, 1), 1);
  v_ini := COALESCE(v_t.data_inicio_planejada, v_t.data_prazo);
  v_fim := COALESCE(v_t.data_prazo, v_ini);
  IF v_ini IS NULL THEN RAISE EXCEPTION 'Defina as datas do evento antes de torná-lo recorrente'; END IF;
  v_dur := v_fim - v_ini;
  v_lim := COALESCE(p_ate, (v_ini + INTERVAL '6 months')::date);

  INSERT INTO projeto_tarefa_recorrencias(projeto_id, tarefa_base_id, frequencia, intervalo, ate_data, criado_por)
  VALUES (v_t.projeto_id, p_tarefa_id, p_frequencia, v_int, v_lim, auth.uid())
  RETURNING id INTO v_rec;

  UPDATE projeto_tarefas SET recorrencia_id = v_rec, ocorrencia_data = v_ini WHERE id = p_tarefa_id;

  WHILE v_i <= v_max LOOP
    IF p_frequencia = 'semanal' THEN
      d := v_ini + ((v_i * v_int) * 7);
    ELSE
      d := (v_ini + ((v_i * v_int) || ' months')::interval)::date;
    END IF;
    EXIT WHEN d > v_lim;
    INSERT INTO projeto_tarefas(
      projeto_id, secao_id, titulo, descricao, status, prioridade, estagio,
      responsavel_id, criador_id, data_inicio_planejada, data_prazo,
      recorrencia_id, ocorrencia_data, ordem, tipo_tarefa
    ) VALUES (
      v_t.projeto_id, v_t.secao_id, v_t.titulo, v_t.descricao, 'pendente', v_t.prioridade, v_t.estagio,
      v_t.responsavel_id, auth.uid(), d, d + v_dur,
      v_rec, d, v_t.ordem, v_t.tipo_tarefa
    );
    v_i := v_i + 1;
  END LOOP;

  RETURN v_rec;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_encerrar_recorrencia(
  p_recorrencia_id uuid,
  p_a_partir date DEFAULT CURRENT_DATE
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r record; v_count integer := 0;
BEGIN
  SELECT * INTO v_r FROM projeto_tarefa_recorrencias WHERE id = p_recorrencia_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recorrência não encontrada'; END IF;
  IF NOT (public.user_can_access_projeto(auth.uid(), v_r.projeto_id) OR v_r.criado_por = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para encerrar esta recorrência';
  END IF;

  UPDATE projeto_tarefas SET deleted_at = now()
  WHERE recorrencia_id = p_recorrencia_id
    AND id <> v_r.tarefa_base_id
    AND deleted_at IS NULL
    AND status <> 'concluida'
    AND ocorrencia_data >= p_a_partir;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE projeto_tarefa_recorrencias
  SET ativa = false, ate_data = LEAST(COALESCE(ate_data, p_a_partir), p_a_partir), updated_at = now()
  WHERE id = p_recorrencia_id;

  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_desvincular_ocorrencia(p_tarefa_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t record;
BEGIN
  SELECT * INTO v_t FROM projeto_tarefas WHERE id = p_tarefa_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  IF NOT (public.user_can_access_projeto(auth.uid(), v_t.projeto_id)
          OR v_t.criador_id = auth.uid() OR v_t.responsavel_id = auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE projeto_tarefas SET recorrencia_id = NULL WHERE id = p_tarefa_id;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_criar_evento_recorrente(uuid, text, integer, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_encerrar_recorrencia(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_desvincular_ocorrencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_criar_evento_recorrente(uuid, text, integer, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_encerrar_recorrencia(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_desvincular_ocorrencia(uuid) TO authenticated;