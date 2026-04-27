
-- =========================================================
-- PROJETO_MODELOS — Modelos personalizados de projeto
-- =========================================================

CREATE TABLE IF NOT EXISTS public.projeto_modelos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  icone TEXT,
  cor TEXT,
  escopo TEXT NOT NULL DEFAULT 'pessoal' CHECK (escopo IN ('pessoal','departamento','organizacao')),
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  vinculado_produto BOOLEAN NOT NULL DEFAULT false,
  estrutura JSONB NOT NULL DEFAULT '{"secoes":[]}'::jsonb,
  criado_por UUID NOT NULL,
  uso_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projeto_modelos_criador ON public.projeto_modelos(criado_por);
CREATE INDEX IF NOT EXISTS idx_projeto_modelos_escopo ON public.projeto_modelos(escopo);
CREATE INDEX IF NOT EXISTS idx_projeto_modelos_dept ON public.projeto_modelos(departamento_id);

ALTER TABLE public.projeto_modelos ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_projeto_modelos_updated_at ON public.projeto_modelos;
CREATE TRIGGER trg_projeto_modelos_updated_at
BEFORE UPDATE ON public.projeto_modelos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Helper: verifica se usuário é do Departamento Projetos
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_user_in_projetos_department(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.departamentos d ON d.id = p.departamento_id
    WHERE p.id = _user_id
      AND d.ativo = true
      AND (
        unaccent(lower(d.nome)) IN ('projetos','projects','desenvolvimento de produto','desenvolvimento de produtos')
      )
  );
$$;

-- =========================================================
-- RLS para projeto_modelos
-- =========================================================
DROP POLICY IF EXISTS "modelos_select" ON public.projeto_modelos;
CREATE POLICY "modelos_select" ON public.projeto_modelos
FOR SELECT USING (
  criado_por = auth.uid()
  OR escopo = 'organizacao'
  OR (
    escopo = 'departamento'
    AND departamento_id IN (
      SELECT departamento_id FROM public.profiles WHERE id = auth.uid() AND departamento_id IS NOT NULL
    )
  )
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "modelos_insert" ON public.projeto_modelos;
CREATE POLICY "modelos_insert" ON public.projeto_modelos
FOR INSERT WITH CHECK (
  criado_por = auth.uid()
);

DROP POLICY IF EXISTS "modelos_update" ON public.projeto_modelos;
CREATE POLICY "modelos_update" ON public.projeto_modelos
FOR UPDATE USING (
  criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "modelos_delete" ON public.projeto_modelos;
CREATE POLICY "modelos_delete" ON public.projeto_modelos
FOR DELETE USING (
  criado_por = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- =========================================================
-- Trigger: vinculado_produto exige criador no Dpto Projetos ou admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_modelo_vinculo_produto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vinculado_produto = true THEN
    IF NOT (public.has_role(NEW.criado_por, 'admin') OR public.is_user_in_projetos_department(NEW.criado_por)) THEN
      RAISE EXCEPTION 'Apenas usuários do Departamento Projetos ou administradores podem criar modelos vinculados a produtos.';
    END IF;
  END IF;

  IF NEW.escopo = 'departamento' AND NEW.departamento_id IS NULL THEN
    RAISE EXCEPTION 'Modelos com escopo "departamento" exigem o campo departamento_id.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_modelo_vinculo ON public.projeto_modelos;
CREATE TRIGGER trg_validate_modelo_vinculo
BEFORE INSERT OR UPDATE ON public.projeto_modelos
FOR EACH ROW
EXECUTE FUNCTION public.validate_modelo_vinculo_produto();

-- =========================================================
-- Trigger em projetos: bloqueia tipo='desenvolvimento_produto'
-- para quem não é admin nem do Dpto Projetos
-- =========================================================
CREATE OR REPLACE FUNCTION public.validate_projeto_tipo_desenvolvimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'desenvolvimento_produto' THEN
    IF NOT (public.has_role(NEW.criador_id, 'admin') OR public.is_user_in_projetos_department(NEW.criador_id)) THEN
      RAISE EXCEPTION 'Apenas usuários do Departamento Projetos ou administradores podem criar projetos do tipo "Desenvolvimento de Produto".';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_projeto_tipo_dev ON public.projetos;
CREATE TRIGGER trg_validate_projeto_tipo_dev
BEFORE INSERT OR UPDATE OF tipo ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.validate_projeto_tipo_desenvolvimento();
