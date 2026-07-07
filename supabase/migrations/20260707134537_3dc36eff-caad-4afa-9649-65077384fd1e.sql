
-- 1. departamentos.projeto_operacional_id
ALTER TABLE public.departamentos ADD COLUMN IF NOT EXISTS projeto_operacional_id uuid;

-- 2. projetos.tipo_operacional
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS tipo_operacional boolean NOT NULL DEFAULT false;

-- 3. processo_etapas.parecer_administrativo
ALTER TABLE public.processo_etapas ADD COLUMN IF NOT EXISTS parecer_administrativo text;

-- 4. processo_tarefa_espelho: novas colunas de rastreio
ALTER TABLE public.processo_tarefa_espelho
  ADD COLUMN IF NOT EXISTS execucao_id uuid,
  ADD COLUMN IF NOT EXISTS departamento_id uuid,
  ADD COLUMN IF NOT EXISTS sla_limite timestamptz,
  ADD COLUMN IF NOT EXISTS escalonado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_esp_sla_pending
  ON public.processo_tarefa_espelho (sla_limite)
  WHERE escalonado_em IS NULL AND concluida_em IS NULL;

-- 5. projeto_tarefas.origem
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS origem text;
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_origem
  ON public.projeto_tarefas (origem)
  WHERE origem IS NOT NULL;

-- 6. processo_etapa_responsaveis (papéis configurados no double-click)
CREATE TABLE IF NOT EXISTS public.processo_etapa_responsaveis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  etapa_id uuid NOT NULL REFERENCES public.processo_etapas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL CHECK (papel IN ('responsavel','seguidor','escalonado')),
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etapa_id, user_id, papel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.processo_etapa_responsaveis TO authenticated;
GRANT ALL ON public.processo_etapa_responsaveis TO service_role;

ALTER TABLE public.processo_etapa_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read papeis etapa autenticado"
  ON public.processo_etapa_responsaveis FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "manage papeis etapa admin"
  ON public.processo_etapa_responsaveis FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR criado_por = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR criado_por = auth.uid());

CREATE INDEX IF NOT EXISTS idx_etapa_papeis_etapa ON public.processo_etapa_responsaveis(etapa_id);
CREATE INDEX IF NOT EXISTS idx_etapa_papeis_user ON public.processo_etapa_responsaveis(user_id);

-- 7. RPC: ensure_projeto_operacional
CREATE OR REPLACE FUNCTION public.ensure_projeto_operacional(_departamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_dep_nome text;
  v_uid uuid := auth.uid();
BEGIN
  SELECT projeto_operacional_id, nome
    INTO v_projeto_id, v_dep_nome
  FROM public.departamentos
  WHERE id = _departamento_id;

  IF v_projeto_id IS NOT NULL THEN
    RETURN v_projeto_id;
  END IF;

  INSERT INTO public.projetos (nome, descricao, tipo_operacional, criador_id, status)
  VALUES (
    'Operacional — ' || COALESCE(v_dep_nome,'Departamento'),
    'Projeto operacional automático para execução de processos do departamento.',
    true,
    v_uid,
    'ativo'
  )
  RETURNING id INTO v_projeto_id;

  UPDATE public.departamentos
     SET projeto_operacional_id = v_projeto_id
   WHERE id = _departamento_id;

  BEGIN
    INSERT INTO public.projeto_departamentos (projeto_id, departamento_id)
    VALUES (v_projeto_id, _departamento_id)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_projeto_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_projeto_operacional(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_projeto_operacional(uuid) TO authenticated;
