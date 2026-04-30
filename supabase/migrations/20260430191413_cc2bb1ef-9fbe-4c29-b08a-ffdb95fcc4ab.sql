-- ====== Tabelas ======
CREATE TABLE public.central_copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Nova conversa',
  salvo boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_central_copilot_threads_user ON public.central_copilot_threads(user_id, updated_at DESC);
CREATE INDEX idx_central_copilot_threads_expires ON public.central_copilot_threads(expires_at) WHERE salvo = false;

CREATE TABLE public.central_copilot_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.central_copilot_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL DEFAULT '',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  tool_calls jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_central_copilot_mensagens_thread ON public.central_copilot_mensagens(thread_id, created_at);

CREATE TABLE public.central_copilot_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.central_copilot_threads(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.central_copilot_mensagens(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposta' CHECK (status IN ('proposta','aplicada','descartada','falhou','expirada')),
  projeto_id uuid, -- derivado da tarefa, snapshot
  resultado jsonb,
  aplicada_por uuid,
  aplicada_em timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_central_copilot_acoes_thread ON public.central_copilot_acoes(thread_id);

CREATE TABLE public.central_copilot_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  thread_id uuid REFERENCES public.central_copilot_threads(id) ON DELETE SET NULL,
  tipo text NOT NULL DEFAULT 'dinamico',
  formato text NOT NULL CHECK (formato IN ('pdf','xlsx')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro text,
  nome_personalizado text,
  salvo boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_central_copilot_relatorios_user ON public.central_copilot_relatorios(user_id, created_at DESC);
CREATE INDEX idx_central_copilot_relatorios_expires ON public.central_copilot_relatorios(expires_at) WHERE salvo = false;

CREATE TABLE public.central_copilot_relatorio_tarefas (
  relatorio_id uuid NOT NULL REFERENCES public.central_copilot_relatorios(id) ON DELETE CASCADE,
  tarefa_id uuid NOT NULL,
  anexo_id uuid,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (relatorio_id, tarefa_id)
);

CREATE TABLE public.central_copilot_user_profile (
  user_id uuid PRIMARY KEY,
  perfil_resumo text,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  mensagens_observadas integer NOT NULL DEFAULT 0,
  ultima_atualizacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ====== RLS ======
ALTER TABLE public.central_copilot_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_copilot_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_copilot_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_copilot_relatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_copilot_relatorio_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_copilot_user_profile ENABLE ROW LEVEL SECURITY;

-- threads: dono manipula
CREATE POLICY "central_threads_owner_all" ON public.central_copilot_threads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- mensagens: dono via thread
CREATE POLICY "central_mensagens_owner_all" ON public.central_copilot_mensagens
  FOR ALL TO authenticated
  USING (thread_id IN (SELECT id FROM public.central_copilot_threads WHERE user_id = auth.uid()))
  WITH CHECK (thread_id IN (SELECT id FROM public.central_copilot_threads WHERE user_id = auth.uid()));

-- ações: dono via thread
CREATE POLICY "central_acoes_owner_all" ON public.central_copilot_acoes
  FOR ALL TO authenticated
  USING (thread_id IN (SELECT id FROM public.central_copilot_threads WHERE user_id = auth.uid()))
  WITH CHECK (thread_id IN (SELECT id FROM public.central_copilot_threads WHERE user_id = auth.uid()));

-- relatórios: dono
CREATE POLICY "central_relatorios_owner_all" ON public.central_copilot_relatorios
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- relatório-tarefa: dono via relatório
CREATE POLICY "central_rel_tar_owner_all" ON public.central_copilot_relatorio_tarefas
  FOR ALL TO authenticated
  USING (relatorio_id IN (SELECT id FROM public.central_copilot_relatorios WHERE user_id = auth.uid()))
  WITH CHECK (relatorio_id IN (SELECT id FROM public.central_copilot_relatorios WHERE user_id = auth.uid()));

-- perfil: só dono
CREATE POLICY "central_user_profile_owner_all" ON public.central_copilot_user_profile
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ====== Funções utilitárias ======
CREATE OR REPLACE FUNCTION public.copilot_set_central_thread_salvo(_thread_id uuid, _salvo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.central_copilot_threads
  SET salvo = _salvo,
      expires_at = CASE WHEN _salvo THEN now() + interval '100 years' ELSE now() + interval '30 days' END,
      updated_at = now()
  WHERE id = _thread_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'thread_nao_encontrada'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.copilot_set_central_relatorio_salvo(
  _relatorio_id uuid, _salvo boolean, _nome_personalizado text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.central_copilot_relatorios
  SET salvo = _salvo,
      expires_at = CASE WHEN _salvo THEN now() + interval '100 years' ELSE now() + interval '30 days' END,
      nome_personalizado = COALESCE(_nome_personalizado, nome_personalizado),
      updated_at = now()
  WHERE id = _relatorio_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'relatorio_nao_encontrado'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.copilot_set_central_thread_salvo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copilot_set_central_relatorio_salvo(uuid, boolean, text) TO authenticated;