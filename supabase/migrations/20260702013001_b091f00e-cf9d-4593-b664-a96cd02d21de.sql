
-- Copiloto de Pedidos & Rastreamento — armazena relatórios gerados e alertas configurados por usuário.
CREATE TABLE IF NOT EXISTS public.pedidos_copilot_relatorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  markdown TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'chat' CHECK (origem IN ('chat','alerta','manual')),
  salvo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS idx_pedidos_copilot_relatorios_user ON public.pedidos_copilot_relatorios(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_copilot_relatorios TO authenticated;
GRANT ALL ON public.pedidos_copilot_relatorios TO service_role;
ALTER TABLE public.pedidos_copilot_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own relatorios select" ON public.pedidos_copilot_relatorios
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own relatorios insert" ON public.pedidos_copilot_relatorios
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own relatorios update" ON public.pedidos_copilot_relatorios
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own relatorios delete" ON public.pedidos_copilot_relatorios
  FOR DELETE TO authenticated USING (user_id = auth.uid());


CREATE TABLE IF NOT EXISTS public.pedidos_copilot_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('atraso','novos_pedidos','vendas_cliente')),
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  cron_expr TEXT NOT NULL DEFAULT '0 8 * * *',
  ativo BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_copilot_alertas_user ON public.pedidos_copilot_alertas(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_copilot_alertas TO authenticated;
GRANT ALL ON public.pedidos_copilot_alertas TO service_role;
ALTER TABLE public.pedidos_copilot_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own alertas select" ON public.pedidos_copilot_alertas
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own alertas insert" ON public.pedidos_copilot_alertas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own alertas update" ON public.pedidos_copilot_alertas
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own alertas delete" ON public.pedidos_copilot_alertas
  FOR DELETE TO authenticated USING (user_id = auth.uid());
