
ALTER TABLE public.planos_reducao
  ADD COLUMN IF NOT EXISTS custo_alvo_mensal numeric(15,2) NOT NULL DEFAULT 5500;

CREATE TABLE IF NOT EXISTS public.plano_reducao_despesas_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid NOT NULL REFERENCES public.planos_reducao(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  descricao text NOT NULL,
  valor_mensal numeric(15,2) NOT NULL DEFAULT 0,
  valores_mensais jsonb NOT NULL DEFAULT '{}'::jsonb,
  tipo text NOT NULL DEFAULT 'eliminar' CHECK (tipo IN ('eliminar','reduzir','manter')),
  ordem integer NOT NULL DEFAULT 0,
  criado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plano_red_despesas_extras_plano
  ON public.plano_reducao_despesas_extras(plano_id);

ALTER TABLE public.plano_reducao_despesas_extras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "despesas_extras_select" ON public.plano_reducao_despesas_extras;
DROP POLICY IF EXISTS "despesas_extras_insert" ON public.plano_reducao_despesas_extras;
DROP POLICY IF EXISTS "despesas_extras_update" ON public.plano_reducao_despesas_extras;
DROP POLICY IF EXISTS "despesas_extras_delete" ON public.plano_reducao_despesas_extras;

CREATE POLICY "despesas_extras_select" ON public.plano_reducao_despesas_extras
  FOR SELECT TO authenticated
  USING (public.user_can_access_plano(auth.uid(), plano_id));

CREATE POLICY "despesas_extras_insert" ON public.plano_reducao_despesas_extras
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_plano(auth.uid(), plano_id) AND criado_por = auth.uid());

CREATE POLICY "despesas_extras_update" ON public.plano_reducao_despesas_extras
  FOR UPDATE TO authenticated
  USING (public.user_can_access_plano(auth.uid(), plano_id));

CREATE POLICY "despesas_extras_delete" ON public.plano_reducao_despesas_extras
  FOR DELETE TO authenticated
  USING (public.user_can_access_plano(auth.uid(), plano_id));

DROP TRIGGER IF EXISTS trg_plano_red_despesas_extras_updated_at ON public.plano_reducao_despesas_extras;
CREATE TRIGGER trg_plano_red_despesas_extras_updated_at
  BEFORE UPDATE ON public.plano_reducao_despesas_extras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
