
CREATE TABLE public.estoque_copilot_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Nova conversa',
  filtros_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  salvo boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estoque_copilot_threads_user_idx ON public.estoque_copilot_threads(user_id, updated_at DESC);
CREATE INDEX estoque_copilot_threads_expires_idx ON public.estoque_copilot_threads(expires_at) WHERE salvo = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_copilot_threads TO authenticated;
GRANT ALL ON public.estoque_copilot_threads TO service_role;
ALTER TABLE public.estoque_copilot_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gerencia suas threads de estoque"
  ON public.estoque_copilot_threads
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.estoque_copilot_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.estoque_copilot_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','tool','system')),
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  sources jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estoque_copilot_mensagens_thread_idx ON public.estoque_copilot_mensagens(thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_copilot_mensagens TO authenticated;
GRANT ALL ON public.estoque_copilot_mensagens TO service_role;
ALTER TABLE public.estoque_copilot_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gerencia mensagens das proprias threads de estoque"
  ON public.estoque_copilot_mensagens
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.estoque_copilot_threads t
      WHERE t.id = estoque_copilot_mensagens.thread_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.estoque_copilot_threads t
      WHERE t.id = estoque_copilot_mensagens.thread_id AND t.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.tg_estoque_copilot_threads_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.salvo = true AND OLD.salvo = false THEN
    NEW.expires_at = now() + interval '10 years';
  ELSIF NEW.salvo = false AND OLD.salvo = true THEN
    NEW.expires_at = now() + interval '30 days';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER estoque_copilot_threads_touch
  BEFORE UPDATE ON public.estoque_copilot_threads
  FOR EACH ROW EXECUTE FUNCTION public.tg_estoque_copilot_threads_touch();
