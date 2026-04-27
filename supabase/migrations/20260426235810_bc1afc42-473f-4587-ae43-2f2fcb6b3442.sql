
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS regime_calendario text NOT NULL DEFAULT 'dias_uteis',
  ADD COLUMN IF NOT EXISTS usa_feriados boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS uf_feriados text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim_alvo date,
  ADD COLUMN IF NOT EXISTS prazo_padrao_tarefa integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS alerta_antecipacao_dias integer NOT NULL DEFAULT 2;

ALTER TABLE public.projetos DROP CONSTRAINT IF EXISTS projetos_regime_calendario_check;
ALTER TABLE public.projetos
  ADD CONSTRAINT projetos_regime_calendario_check
  CHECK (regime_calendario IN ('corridos','dias_uteis','uteis_com_sabado'));

CREATE TABLE IF NOT EXISTS public.feriados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional',
  uf text,
  fonte text NOT NULL DEFAULT 'manual',
  ano integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feriados_tipo_check CHECK (tipo IN ('nacional','estadual','municipal','empresa')),
  CONSTRAINT feriados_fonte_check CHECK (fonte IN ('brasilapi','manual'))
);
CREATE UNIQUE INDEX IF NOT EXISTS feriados_uniq_data_uf_tipo
  ON public.feriados (data, COALESCE(uf,''), tipo);
CREATE INDEX IF NOT EXISTS feriados_ano_idx ON public.feriados (ano);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Feriados visiveis para autenticados" ON public.feriados;
CREATE POLICY "Feriados visiveis para autenticados"
  ON public.feriados FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia feriados" ON public.feriados;
CREATE POLICY "Admin gerencia feriados"
  ON public.feriados FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.projeto_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'entrega',
  valor_alvo numeric NOT NULL DEFAULT 100,
  valor_atual numeric NOT NULL DEFAULT 0,
  unidade text DEFAULT '%',
  data_inicio date,
  data_alvo date,
  status text NOT NULL DEFAULT 'em_andamento',
  peso integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projeto_metas_tipo_check CHECK (tipo IN ('entrega','qualidade','prazo','custo','volume')),
  CONSTRAINT projeto_metas_status_check CHECK (status IN ('em_andamento','em_risco','atrasada','concluida'))
);
CREATE INDEX IF NOT EXISTS projeto_metas_projeto_idx ON public.projeto_metas (projeto_id);
CREATE INDEX IF NOT EXISTS projeto_metas_status_idx ON public.projeto_metas (status);

ALTER TABLE public.projeto_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros leem metas do projeto" ON public.projeto_metas;
CREATE POLICY "Membros leem metas do projeto"
  ON public.projeto_metas FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.projeto_membros m WHERE m.projeto_id = projeto_metas.projeto_id AND m.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.projeto_departamentos pd
      JOIN public.profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = projeto_metas.projeto_id AND pr.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Gestores gerenciam metas" ON public.projeto_metas;
CREATE POLICY "Gestores gerenciam metas"
  ON public.projeto_metas FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_role(auth.uid(),'supervisor')
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_role(auth.uid(),'supervisor')
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  );

ALTER TABLE public.projeto_planos_acao
  ADD COLUMN IF NOT EXISTS meta_id uuid REFERENCES public.projeto_metas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projeto_planos_acao_meta_idx ON public.projeto_planos_acao (meta_id);

CREATE TABLE IF NOT EXISTS public.projeto_relatorios_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid REFERENCES public.projetos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  periodo_inicio date,
  periodo_fim date,
  conteudo_md text,
  dados_json jsonb,
  gerado_por uuid,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projeto_relatorios_ia_tipo_check CHECK (tipo IN ('status_semanal','burndown','analise_atrasos','produtividade','executivo','preditivo','metas_diagnostico','metas_plano_acao','metas_pauta_reuniao'))
);
CREATE INDEX IF NOT EXISTS projeto_relatorios_ia_projeto_idx ON public.projeto_relatorios_ia (projeto_id, tipo, gerado_em DESC);

ALTER TABLE public.projeto_relatorios_ia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membros leem relatorios IA" ON public.projeto_relatorios_ia;
CREATE POLICY "Membros leem relatorios IA"
  ON public.projeto_relatorios_ia FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR projeto_id IS NULL
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.projeto_membros m WHERE m.projeto_id = projeto_relatorios_ia.projeto_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Gestores escrevem relatorios IA" ON public.projeto_relatorios_ia;
CREATE POLICY "Gestores escrevem relatorios IA"
  ON public.projeto_relatorios_ia FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gerente')
    OR public.has_role(auth.uid(),'supervisor')
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND p.criador_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.calcular_data_util(
  data_base date, dias integer, p_projeto_id uuid DEFAULT NULL
)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_regime text := 'dias_uteis';
  v_usa_feriados boolean := true;
  v_uf text := 'BR';
  v_data date := data_base;
  v_remaining integer := dias;
  v_dow integer;
  v_e_feriado boolean;
BEGIN
  IF data_base IS NULL OR dias IS NULL THEN RETURN NULL; END IF;
  IF p_projeto_id IS NOT NULL THEN
    SELECT regime_calendario, usa_feriados, uf_feriados
    INTO v_regime, v_usa_feriados, v_uf
    FROM public.projetos WHERE id = p_projeto_id;
  END IF;
  IF v_regime = 'corridos' THEN RETURN data_base + dias; END IF;
  WHILE v_remaining > 0 LOOP
    v_data := v_data + 1;
    v_dow := EXTRACT(DOW FROM v_data);
    IF v_regime = 'dias_uteis' AND (v_dow = 0 OR v_dow = 6) THEN CONTINUE; END IF;
    IF v_regime = 'uteis_com_sabado' AND v_dow = 0 THEN CONTINUE; END IF;
    IF v_usa_feriados THEN
      SELECT EXISTS (
        SELECT 1 FROM public.feriados f
        WHERE f.data = v_data AND (f.uf IS NULL OR f.uf = v_uf OR v_uf = 'BR')
      ) INTO v_e_feriado;
      IF v_e_feriado THEN CONTINUE; END IF;
    END IF;
    v_remaining := v_remaining - 1;
  END LOOP;
  RETURN v_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_meta_projeto()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_progresso numeric;
  v_dias_total integer;
  v_dias_decorridos integer;
  v_pct_tempo numeric;
BEGIN
  IF NEW.valor_alvo IS NULL OR NEW.valor_alvo = 0 THEN NEW.valor_alvo := 100; END IF;
  v_progresso := (NEW.valor_atual / NEW.valor_alvo) * 100;
  IF v_progresso >= 100 THEN
    NEW.status := 'concluida';
  ELSIF NEW.data_alvo IS NOT NULL AND NEW.data_alvo < CURRENT_DATE THEN
    NEW.status := 'atrasada';
  ELSIF NEW.data_alvo IS NOT NULL AND NEW.data_inicio IS NOT NULL THEN
    v_dias_total := GREATEST((NEW.data_alvo - NEW.data_inicio), 1);
    v_dias_decorridos := GREATEST((CURRENT_DATE - NEW.data_inicio), 0);
    v_pct_tempo := (v_dias_decorridos::numeric / v_dias_total::numeric) * 100;
    IF v_pct_tempo > 80 AND v_progresso < 70 THEN
      NEW.status := 'em_risco';
    ELSE
      NEW.status := 'em_andamento';
    END IF;
  ELSE
    NEW.status := 'em_andamento';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_status_meta_projeto ON public.projeto_metas;
CREATE TRIGGER trg_status_meta_projeto
BEFORE INSERT OR UPDATE OF valor_atual, valor_alvo, data_alvo, data_inicio
ON public.projeto_metas
FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_meta_projeto();
