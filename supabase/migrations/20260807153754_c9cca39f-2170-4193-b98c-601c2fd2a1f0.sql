-- 1) Tags nos eventos
ALTER TABLE public.calendario_eventos
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 2) Histórico de alterações
CREATE TABLE IF NOT EXISTS public.calendario_evento_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.calendario_eventos(id) ON DELETE CASCADE,
  recorrencia_id uuid,
  user_id uuid NOT NULL,
  acao text NOT NULL,
  escopo text NOT NULL DEFAULT 'unico',
  alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_hist_evento ON public.calendario_evento_historico(evento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_hist_serie ON public.calendario_evento_historico(recorrencia_id);

GRANT SELECT, INSERT ON public.calendario_evento_historico TO authenticated;
GRANT ALL ON public.calendario_evento_historico TO service_role;

ALTER TABLE public.calendario_evento_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist_select_eventos_visiveis"
  ON public.calendario_evento_historico FOR SELECT TO authenticated
  USING (evento_id IN (SELECT id FROM public.calendario_eventos));

CREATE POLICY "hist_insert_proprio"
  ON public.calendario_evento_historico FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND evento_id IN (SELECT id FROM public.calendario_eventos));

-- 3) Preferências por usuário (filtros salvos + lembretes)
CREATE TABLE IF NOT EXISTS public.calendario_preferencias (
  user_id uuid PRIMARY KEY,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  lembretes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_preferencias TO authenticated;
GRANT ALL ON public.calendario_preferencias TO service_role;

ALTER TABLE public.calendario_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_calendario_proprias"
  ON public.calendario_preferencias FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_calendario_preferencias_updated_at
  BEFORE UPDATE ON public.calendario_preferencias
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();