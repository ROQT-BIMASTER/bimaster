
-- Add departamento_id column to projetos
ALTER TABLE public.projetos
ADD COLUMN departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_projetos_departamento_id ON public.projetos(departamento_id);

-- Recreate user_can_access_projeto with department logic
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin sees everything
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin')
    -- Creator always sees
    OR EXISTS (SELECT 1 FROM projetos WHERE id = _projeto_id AND criador_id = _user_id)
    -- Registered member always sees
    OR EXISTS (SELECT 1 FROM projeto_membros WHERE projeto_id = _projeto_id AND user_id = _user_id)
    -- Same department (if project has one)
    OR EXISTS (
      SELECT 1 FROM projetos p
      JOIN profiles pr ON pr.departamento_id = p.departamento_id
      WHERE p.id = _projeto_id AND pr.id = _user_id AND p.departamento_id IS NOT NULL
    )
$$;
