
-- 1. Create junction table
CREATE TABLE public.projeto_departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  departamento_id UUID NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(projeto_id, departamento_id)
);

CREATE INDEX idx_projeto_departamentos_projeto ON public.projeto_departamentos(projeto_id);
CREATE INDEX idx_projeto_departamentos_depto ON public.projeto_departamentos(departamento_id);

ALTER TABLE public.projeto_departamentos ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "admin_manage_projeto_departamentos" ON public.projeto_departamentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Authenticated users can read (needed for RLS function)
CREATE POLICY "authenticated_read_projeto_departamentos" ON public.projeto_departamentos
  FOR SELECT TO authenticated
  USING (true);

-- 2. Migrate existing departamento_id data to junction table
INSERT INTO public.projeto_departamentos (projeto_id, departamento_id)
SELECT id, departamento_id FROM public.projetos WHERE departamento_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Update access function to use junction table
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id)
    OR EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1 FROM projeto_departamentos pd
      JOIN profiles pr ON pr.departamento_id = pd.departamento_id
      WHERE pd.projeto_id = _projeto_id AND pr.id = _user_id
    )
$$;
