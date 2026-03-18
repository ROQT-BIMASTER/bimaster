-- Create table for field-level visibility control per department
CREATE TABLE public.departamento_campo_visibilidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departamento_controlador_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  departamento_alvo_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  tela_codigo text NOT NULL,
  campo_codigo text NOT NULL,
  visivel boolean NOT NULL DEFAULT false,
  editavel boolean NOT NULL DEFAULT false,
  configurado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(departamento_controlador_id, departamento_alvo_id, tela_codigo, campo_codigo)
);

-- RLS
ALTER TABLE public.departamento_campo_visibilidade ENABLE ROW LEVEL SECURITY;

-- Only admins and dept managers can manage
CREATE POLICY "admin_or_dept_manager_select" ON public.departamento_campo_visibilidade
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.departamentos d
    WHERE d.id = departamento_controlador_id
    AND d.responsavel_id = auth.uid()
  )
);

CREATE POLICY "admin_or_dept_manager_insert" ON public.departamento_campo_visibilidade
FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.departamentos d
    WHERE d.id = departamento_controlador_id
    AND d.responsavel_id = auth.uid()
  )
);

CREATE POLICY "admin_or_dept_manager_update" ON public.departamento_campo_visibilidade
FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.departamentos d
    WHERE d.id = departamento_controlador_id
    AND d.responsavel_id = auth.uid()
  )
);

CREATE POLICY "admin_or_dept_manager_delete" ON public.departamento_campo_visibilidade
FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.departamentos d
    WHERE d.id = departamento_controlador_id
    AND d.responsavel_id = auth.uid()
  )
);

-- Members of the target department can read their own visibility rules
CREATE POLICY "target_dept_members_select" ON public.departamento_campo_visibilidade
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.departamento_id = departamento_alvo_id
  )
);

-- Create audit table for visibility changes
CREATE TABLE public.departamento_visibilidade_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_visibilidade_id uuid REFERENCES public.departamento_campo_visibilidade(id) ON DELETE SET NULL,
  departamento_alvo_id uuid NOT NULL,
  tela_codigo text NOT NULL,
  campo_codigo text NOT NULL,
  acao text NOT NULL,
  valor_anterior jsonb,
  valor_novo jsonb,
  alterado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departamento_visibilidade_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_select_audit" ON public.departamento_visibilidade_audit
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.departamentos d
  WHERE d.responsavel_id = auth.uid()
));

CREATE POLICY "authenticated_insert_audit" ON public.departamento_visibilidade_audit
FOR INSERT TO authenticated WITH CHECK (true);

-- Security definer function to check field visibility
CREATE OR REPLACE FUNCTION public.campo_visivel_para_departamento(
  p_departamento_id uuid,
  p_tela_codigo text,
  p_campo_codigo text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT visivel FROM public.departamento_campo_visibilidade
     WHERE departamento_alvo_id = p_departamento_id
     AND tela_codigo = p_tela_codigo
     AND campo_codigo = p_campo_codigo
     LIMIT 1),
    true -- default: visible if no rule exists
  );
$$;