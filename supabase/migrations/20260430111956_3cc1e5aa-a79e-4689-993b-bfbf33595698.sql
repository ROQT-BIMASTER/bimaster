
-- =========================================================================
-- Produtividade & Custos de Projetos (Fases 2 + 3)
-- =========================================================================

-- 1) Chat geral do projeto (resumo diário automático + mensagens livres)
CREATE TABLE IF NOT EXISTS public.projeto_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid,                     -- NULL = sistema (resumo automático)
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'mensagem'
    CHECK (tipo IN ('mensagem','resumo_diario','sistema')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projeto_chat_messages_projeto
  ON public.projeto_chat_messages (projeto_id, created_at DESC);

ALTER TABLE public.projeto_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read project chat"
  ON public.projeto_chat_messages FOR SELECT
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members write project chat"
  ON public.projeto_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_projeto(auth.uid(), projeto_id)
  );

CREATE POLICY "Authors delete own messages"
  ON public.projeto_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_chat_messages;

-- 2) Custo-hora por pessoa (com vigência histórica)
CREATE TABLE IF NOT EXISTS public.projeto_custo_hora_pessoa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custo_hora numeric(12,2) NOT NULL CHECK (custo_hora >= 0),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chp_user_vigente
  ON public.projeto_custo_hora_pessoa (user_id, vigente_desde DESC);

ALTER TABLE public.projeto_custo_hora_pessoa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all custo hora"
  ON public.projeto_custo_hora_pessoa FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

CREATE POLICY "Admin manage custo hora"
  ON public.projeto_custo_hora_pessoa FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Lançamentos de horas
CREATE TABLE IF NOT EXISTS public.projeto_horas_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horas numeric(6,2) NOT NULL CHECK (horas > 0 AND horas <= 24),
  descricao text,
  custo_hora_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual','ia_backfill','importacao')),
  aprovado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phl_projeto_data
  ON public.projeto_horas_lancamentos (projeto_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_phl_user_data
  ON public.projeto_horas_lancamentos (user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_phl_tarefa
  ON public.projeto_horas_lancamentos (tarefa_id) WHERE tarefa_id IS NOT NULL;

ALTER TABLE public.projeto_horas_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read horas"
  ON public.projeto_horas_lancamentos FOR SELECT
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members insert horas"
  ON public.projeto_horas_lancamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_projeto(auth.uid(), projeto_id)
  );

CREATE POLICY "Author updates horas"
  ON public.projeto_horas_lancamentos FOR UPDATE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Author deletes horas"
  ON public.projeto_horas_lancamentos FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4) Custos mensais de tecnologia (Lovable, OpenAI, Supabase, etc)
CREATE TABLE IF NOT EXISTS public.projeto_custos_tecnologia_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,                -- sempre dia 01 do mês
  fornecedor text NOT NULL,
  valor numeric(14,2) NOT NULL CHECK (valor >= 0),
  descricao text,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, fornecedor)
);
CREATE INDEX IF NOT EXISTS idx_pctm_mes
  ON public.projeto_custos_tecnologia_mensal (mes DESC);

ALTER TABLE public.projeto_custos_tecnologia_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tech costs"
  ON public.projeto_custos_tecnologia_mensal FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin manage tech costs"
  ON public.projeto_custos_tecnologia_mensal FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5) Helper: pega custo-hora vigente para uma pessoa numa data
CREATE OR REPLACE FUNCTION public.get_custo_hora(_user_id uuid, _data date)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT custo_hora
    FROM public.projeto_custo_hora_pessoa
    WHERE user_id = _user_id
      AND vigente_desde <= _data
    ORDER BY vigente_desde DESC
    LIMIT 1
  ), 0)::numeric;
$$;

-- 6) Trigger que preenche o snapshot do custo-hora ao inserir lançamento
CREATE OR REPLACE FUNCTION public.trg_set_custo_hora_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.custo_hora_snapshot = 0 THEN
    NEW.custo_hora_snapshot := public.get_custo_hora(NEW.user_id, NEW.data);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phl_snapshot ON public.projeto_horas_lancamentos;
CREATE TRIGGER trg_phl_snapshot
  BEFORE INSERT ON public.projeto_horas_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_custo_hora_snapshot();

-- 7) View de produtividade do projeto (agregado por mês)
CREATE OR REPLACE VIEW public.vw_projeto_produtividade
WITH (security_invoker = true) AS
SELECT
  p.id AS projeto_id,
  p.nome AS projeto_nome,
  date_trunc('month', h.data)::date AS mes,
  COUNT(DISTINCT h.user_id) AS pessoas_ativas,
  SUM(h.horas) AS horas_totais,
  SUM(h.horas * h.custo_hora_snapshot) AS custo_pessoas
FROM public.projetos p
LEFT JOIN public.projeto_horas_lancamentos h ON h.projeto_id = p.id
GROUP BY p.id, p.nome, date_trunc('month', h.data);

-- 8) View de rateio de tecnologia: divide custo mensal entre projetos
--    proporcional às horas. Se nenhum projeto teve horas no mês, divide igualmente.
CREATE OR REPLACE VIEW public.vw_projeto_rateio_tecnologia
WITH (security_invoker = true) AS
WITH horas_mes AS (
  SELECT
    date_trunc('month', data)::date AS mes,
    projeto_id,
    SUM(horas) AS horas
  FROM public.projeto_horas_lancamentos
  GROUP BY 1, 2
),
total_mes AS (
  SELECT mes, SUM(horas) AS horas_total
  FROM horas_mes
  GROUP BY mes
),
custos_mes AS (
  SELECT date_trunc('month', mes)::date AS mes, SUM(valor) AS valor_total
  FROM public.projeto_custos_tecnologia_mensal
  GROUP BY 1
)
SELECT
  hm.mes,
  hm.projeto_id,
  hm.horas,
  cm.valor_total AS custo_tecnologia_mes,
  CASE
    WHEN tm.horas_total > 0
      THEN ROUND(cm.valor_total * (hm.horas / tm.horas_total), 2)
    ELSE 0
  END AS custo_tecnologia_rateado
FROM horas_mes hm
JOIN total_mes tm ON tm.mes = hm.mes
LEFT JOIN custos_mes cm ON cm.mes = hm.mes;

-- 9) RPC: produtividade do dia (usado pelo resumo diário automático)
CREATE OR REPLACE FUNCTION public.projeto_resumo_dia(_projeto_id uuid, _data date)
RETURNS TABLE (
  user_id uuid,
  user_nome text,
  tarefas_concluidas int,
  horas numeric,
  custo numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH conc AS (
    SELECT t.responsavel_id AS uid, COUNT(*)::int AS qtd
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = _projeto_id
      AND t.status = 'concluida'
      AND t.data_conclusao = _data
      AND t.excluida_em IS NULL
    GROUP BY t.responsavel_id
  ),
  hrs AS (
    SELECT user_id AS uid, SUM(horas) AS h, SUM(horas * custo_hora_snapshot) AS c
    FROM public.projeto_horas_lancamentos
    WHERE projeto_id = _projeto_id AND data = _data
    GROUP BY user_id
  ),
  base AS (
    SELECT uid FROM conc
    UNION
    SELECT uid FROM hrs
  )
  SELECT
    b.uid AS user_id,
    COALESCE(pr.nome, pr.email, 'Usuário') AS user_nome,
    COALESCE(c.qtd, 0) AS tarefas_concluidas,
    COALESCE(h.h, 0) AS horas,
    COALESCE(h.c, 0) AS custo
  FROM base b
  LEFT JOIN conc c ON c.uid = b.uid
  LEFT JOIN hrs h ON h.uid = b.uid
  LEFT JOIN public.profiles pr ON pr.id = b.uid
  WHERE b.uid IS NOT NULL
  ORDER BY tarefas_concluidas DESC, horas DESC;
$$;

GRANT EXECUTE ON FUNCTION public.projeto_resumo_dia(uuid,date) TO authenticated, service_role;
