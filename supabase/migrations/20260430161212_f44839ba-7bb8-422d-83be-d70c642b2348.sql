
-- COPILOTO DE PROJETOS - Fase 1

CREATE TABLE public.projeto_copilot_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  arquivada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_threads_user ON public.projeto_copilot_threads(user_id, updated_at DESC);
CREATE INDEX idx_copilot_threads_projeto ON public.projeto_copilot_threads(projeto_id, updated_at DESC);
ALTER TABLE public.projeto_copilot_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "copilot_threads_select" ON public.projeto_copilot_threads
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "copilot_threads_insert" ON public.projeto_copilot_threads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.user_can_access_projeto(auth.uid(), projeto_id)
  );
CREATE POLICY "copilot_threads_update" ON public.projeto_copilot_threads
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "copilot_threads_delete" ON public.projeto_copilot_threads
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.projeto_copilot_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.projeto_copilot_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tool_calls JSONB,
  sources JSONB,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_msgs_thread ON public.projeto_copilot_mensagens(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_copilot_msg_role()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role NOT IN ('user','assistant','system','tool') THEN
    RAISE EXCEPTION 'invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_copilot_msg_role
  BEFORE INSERT OR UPDATE ON public.projeto_copilot_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.validate_copilot_msg_role();

ALTER TABLE public.projeto_copilot_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_msgs_select" ON public.projeto_copilot_mensagens
  FOR SELECT USING (
    thread_id IN (SELECT id FROM public.projeto_copilot_threads WHERE user_id = auth.uid())
    OR public.is_admin()
  );
CREATE POLICY "copilot_msgs_no_direct_insert" ON public.projeto_copilot_mensagens
  FOR INSERT WITH CHECK (false);

CREATE TABLE public.projeto_copilot_acoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.projeto_copilot_threads(id) ON DELETE CASCADE,
  mensagem_id UUID REFERENCES public.projeto_copilot_mensagens(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposta',
  aplicada_por UUID,
  aplicada_em TIMESTAMPTZ,
  resultado JSONB,
  ip INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_copilot_acoes_thread ON public.projeto_copilot_acoes(thread_id, created_at);

CREATE OR REPLACE FUNCTION public.validate_copilot_acao()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('proposta','aplicada','descartada','falhou','expirada') THEN
    RAISE EXCEPTION 'invalid status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_copilot_acao
  BEFORE INSERT OR UPDATE ON public.projeto_copilot_acoes
  FOR EACH ROW EXECUTE FUNCTION public.validate_copilot_acao();

ALTER TABLE public.projeto_copilot_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_acoes_select" ON public.projeto_copilot_acoes
  FOR SELECT USING (
    thread_id IN (SELECT id FROM public.projeto_copilot_threads WHERE user_id = auth.uid())
    OR public.is_admin()
  );
CREATE POLICY "copilot_acoes_no_direct_insert" ON public.projeto_copilot_acoes
  FOR INSERT WITH CHECK (false);

CREATE TABLE public.projeto_copilot_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  thread_id UUID REFERENCES public.projeto_copilot_threads(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  formato TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  erro TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX idx_copilot_relatorios_user ON public.projeto_copilot_relatorios(user_id, created_at DESC);

ALTER TABLE public.projeto_copilot_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_relatorios_select" ON public.projeto_copilot_relatorios
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "copilot_relatorios_no_direct_insert" ON public.projeto_copilot_relatorios
  FOR INSERT WITH CHECK (false);

CREATE TABLE public.projeto_copilot_password_attempts (
  user_id UUID PRIMARY KEY,
  tentativas INTEGER NOT NULL DEFAULT 0,
  janela_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  bloqueado_ate TIMESTAMPTZ
);
ALTER TABLE public.projeto_copilot_password_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copilot_pwd_attempts_admin_select" ON public.projeto_copilot_password_attempts
  FOR SELECT USING (public.is_admin());

CREATE TRIGGER update_copilot_threads_updated_at
  BEFORE UPDATE ON public.projeto_copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projeto_copilot_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.projeto_copilot_relatorios REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_copilot_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_copilot_relatorios;

INSERT INTO storage.buckets (id, name, public)
VALUES ('projeto-relatorios', 'projeto-relatorios', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "copilot_relatorios_bucket_select_owner"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'projeto-relatorios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "copilot_relatorios_bucket_select_admin"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'projeto-relatorios' AND public.is_admin());
