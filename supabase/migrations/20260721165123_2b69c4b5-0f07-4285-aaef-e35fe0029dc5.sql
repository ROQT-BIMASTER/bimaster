
CREATE TABLE IF NOT EXISTS public.tarefa_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 200),
  descricao_curta text CHECK (descricao_curta IS NULL OR length(descricao_curta) <= 500),
  escopo text NOT NULL CHECK (escopo IN ('pessoal','departamento','organizacao')),
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  uso_count integer NOT NULL DEFAULT 0,
  ultimo_uso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefa_modelos_escopo ON public.tarefa_modelos(escopo);
CREATE INDEX IF NOT EXISTS idx_tarefa_modelos_created_by ON public.tarefa_modelos(created_by);
CREATE INDEX IF NOT EXISTS idx_tarefa_modelos_departamento ON public.tarefa_modelos(departamento_id) WHERE departamento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_tarefa_modelo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.escopo = 'departamento' AND NEW.departamento_id IS NULL THEN
    RAISE EXCEPTION 'departamento_id é obrigatório para escopo departamento';
  END IF;
  IF NEW.escopo <> 'departamento' THEN
    NEW.departamento_id := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_validate_tarefa_modelo ON public.tarefa_modelos;
CREATE TRIGGER trg_validate_tarefa_modelo
BEFORE INSERT OR UPDATE ON public.tarefa_modelos
FOR EACH ROW EXECUTE FUNCTION public.validate_tarefa_modelo();

DROP TRIGGER IF EXISTS trg_tarefa_modelos_updated_at ON public.tarefa_modelos;
CREATE TRIGGER trg_tarefa_modelos_updated_at
BEFORE UPDATE ON public.tarefa_modelos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_modelos TO authenticated;
GRANT ALL ON public.tarefa_modelos TO service_role;

ALTER TABLE public.tarefa_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tarefa_modelos_select" ON public.tarefa_modelos;
CREATE POLICY "tarefa_modelos_select" ON public.tarefa_modelos
FOR SELECT TO authenticated USING (
  escopo = 'organizacao'
  OR (escopo = 'pessoal' AND created_by = auth.uid())
  OR (escopo = 'departamento' AND departamento_id IN (
    SELECT departamento_id FROM public.profiles WHERE id = auth.uid() AND departamento_id IS NOT NULL
  ))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "tarefa_modelos_insert" ON public.tarefa_modelos;
CREATE POLICY "tarefa_modelos_insert" ON public.tarefa_modelos
FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND (
    escopo = 'pessoal'
    OR escopo = 'organizacao'
    OR (escopo = 'departamento' AND departamento_id IN (
      SELECT departamento_id FROM public.profiles WHERE id = auth.uid() AND departamento_id IS NOT NULL
    ))
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "tarefa_modelos_update" ON public.tarefa_modelos;
CREATE POLICY "tarefa_modelos_update" ON public.tarefa_modelos
FOR UPDATE TO authenticated USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
) WITH CHECK (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "tarefa_modelos_delete" ON public.tarefa_modelos;
CREATE POLICY "tarefa_modelos_delete" ON public.tarefa_modelos
FOR DELETE TO authenticated USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
