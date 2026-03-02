
-- Create a function to check screen-level access (tela)
CREATE OR REPLACE FUNCTION public.check_user_access_tela(_user_id uuid, _tela_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _department_id uuid;
BEGIN
  SELECT ur.role::text, p.departamento_id
  INTO _role, _department_id
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = _user_id
  LIMIT 1;

  IF _role = 'admin' THEN RETURN true; END IF;
  IF _role IN ('supervisor', 'gerente') THEN RETURN true; END IF;

  -- Check user-level screen permission
  IF EXISTS (
    SELECT 1 FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema ts ON ts.id = upt.tela_id
    WHERE upt.usuario_id = _user_id AND ts.codigo = _tela_code AND ts.ativo = true
  ) THEN RETURN true; END IF;

  -- Check department-level screen permission
  IF _department_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.departamento_permissoes_telas dpt
    JOIN public.telas_sistema ts ON ts.id = dpt.tela_id
    WHERE dpt.departamento_id = _department_id AND ts.codigo = _tela_code AND ts.ativo = true
  ) THEN RETURN true; END IF;

  -- Check role-level screen permission
  IF _role IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissoes_telas rpt
    JOIN public.telas_sistema ts ON ts.id = rpt.tela_id
    WHERE rpt.role = _role AND ts.codigo = _tela_code AND ts.ativo = true
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- Update RLS policies for fabrica_materias_primas to also accept fabrica_mps screen permission
DROP POLICY IF EXISTS "fmp_select" ON public.fabrica_materias_primas;
CREATE POLICY "fmp_select" ON public.fabrica_materias_primas
  FOR SELECT
  USING (check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

DROP POLICY IF EXISTS "fmp_insert" ON public.fabrica_materias_primas;
CREATE POLICY "fmp_insert" ON public.fabrica_materias_primas
  FOR INSERT
  WITH CHECK (check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

DROP POLICY IF EXISTS "fmp_update" ON public.fabrica_materias_primas;
CREATE POLICY "fmp_update" ON public.fabrica_materias_primas
  FOR UPDATE
  USING (check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

DROP POLICY IF EXISTS "fmp_delete" ON public.fabrica_materias_primas;
CREATE POLICY "fmp_delete" ON public.fabrica_materias_primas
  FOR DELETE
  USING (check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

-- Also update categorias policy for fabrica_mps users to see categories
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver categorias" ON public.fabrica_categorias_mp;
CREATE POLICY "Usuários com permissão fabrica podem ver categorias" ON public.fabrica_categorias_mp
  FOR SELECT
  USING (check_user_access(auth.uid(), 'fabrica') OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

-- Update NF-e XMLs policies for fabrica_mps users
DROP POLICY IF EXISTS "Authenticated users can read NF-e XMLs" ON public.fabrica_nfe_xmls;
CREATE POLICY "Authenticated users can read NF-e XMLs" ON public.fabrica_nfe_xmls
  FOR SELECT
  USING (can_access_fabrica(auth.uid()) OR check_user_access_tela(auth.uid(), 'fabrica_mps'));

DROP POLICY IF EXISTS "Authenticated users can insert NF-e XMLs" ON public.fabrica_nfe_xmls;
CREATE POLICY "Authenticated users can insert NF-e XMLs" ON public.fabrica_nfe_xmls
  FOR INSERT
  WITH CHECK (can_access_fabrica(auth.uid()) OR check_user_access_tela(auth.uid(), 'fabrica_mps'));
