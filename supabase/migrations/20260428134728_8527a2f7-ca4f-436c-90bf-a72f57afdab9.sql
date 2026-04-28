-- Tabela de negação explícita de módulos por usuário (override de role/departamento)
CREATE TABLE IF NOT EXISTS public.usuario_modulos_negados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  modulo_id UUID NOT NULL REFERENCES public.modulos_sistema(id) ON DELETE CASCADE,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (usuario_id, modulo_id)
);

ALTER TABLE public.usuario_modulos_negados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam negacoes de modulos"
ON public.usuario_modulos_negados
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario ve suas proprias negacoes"
ON public.usuario_modulos_negados
FOR SELECT
TO authenticated
USING (auth.uid() = usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_modulos_negados_usuario ON public.usuario_modulos_negados(usuario_id);

-- Atualiza a função para excluir módulos negados (admin continua tendo tudo)
CREATE OR REPLACE FUNCTION public.get_all_user_permissions(p_user_id uuid)
 RETURNS TABLE(role text, is_admin boolean, modules text[], screens text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_is_admin boolean;
  v_modules text[];
  v_screens text[];
  v_departamento_id uuid;
BEGIN
  SELECT ur.role::text INTO v_role
  FROM public.user_roles ur
  WHERE ur.user_id = p_user_id
  LIMIT 1;

  v_role := COALESCE(v_role, 'vendedor');
  v_is_admin := (v_role = 'admin');

  IF v_is_admin THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true;

    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true;

    RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
    RETURN;
  END IF;

  SELECT p.departamento_id INTO v_departamento_id
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.usuario_modulos_negados umn
      WHERE umn.usuario_id = p_user_id AND umn.modulo_id = m.id
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.departamento_permissoes_modulos dpm
        WHERE dpm.departamento_id = v_departamento_id AND dpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_modulos rpm
        WHERE rpm.role = v_role::public.app_role AND rpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id AND upm.modulo_id = m.id
      )
    );
  ELSE
    SELECT array_agg(DISTINCT m.codigo)
    INTO v_modules
    FROM public.modulos_sistema m
    WHERE m.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.usuario_modulos_negados umn
      WHERE umn.usuario_id = p_user_id AND umn.modulo_id = m.id
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.role_permissoes_modulos rpm
        WHERE rpm.role = v_role::public.app_role AND rpm.modulo_id = m.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_modulos upm
        WHERE upm.usuario_id = p_user_id AND upm.modulo_id = m.id
      )
    );
  END IF;

  IF v_departamento_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.departamento_permissoes_telas dpt
        WHERE dpt.departamento_id = v_departamento_id AND dpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.role_permissoes_telas rpt
        WHERE rpt.role = v_role::public.app_role AND rpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id AND upt.tela_id = t.id
      )
    );
  ELSE
    SELECT array_agg(DISTINCT t.codigo)
    INTO v_screens
    FROM public.telas_sistema t
    WHERE t.ativo = true
    AND (
      EXISTS (
        SELECT 1 FROM public.role_permissoes_telas rpt
        WHERE rpt.role = v_role::public.app_role AND rpt.tela_id = t.id
      )
      OR EXISTS (
        SELECT 1 FROM public.usuario_permissoes_telas upt
        WHERE upt.usuario_id = p_user_id AND upt.tela_id = t.id
      )
    );
  END IF;

  RETURN QUERY SELECT v_role, v_is_admin, COALESCE(v_modules, ARRAY[]::text[]), COALESCE(v_screens, ARRAY[]::text[]);
END;
$function$;

-- Bloquear trade para Luana
INSERT INTO public.usuario_modulos_negados (usuario_id, modulo_id, motivo)
SELECT '2f3df7bd-7db9-404a-8093-d80168ceab70', m.id, 'Acesso restrito a Projetos'
FROM public.modulos_sistema m
WHERE m.codigo = 'trade'
ON CONFLICT (usuario_id, modulo_id) DO NOTHING;