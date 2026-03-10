CREATE OR REPLACE FUNCTION public.sincronizar_permissoes_usuario(p_user_id uuid, p_force_sync boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  SELECT role INTO v_role
  FROM public.user_roles 
  WHERE user_id = p_user_id 
  LIMIT 1;

  IF v_role = 'admin'::public.app_role THEN 
    RETURN; 
  END IF;

  IF p_force_sync THEN
    DELETE FROM public.usuario_permissoes_telas WHERE usuario_id = p_user_id;
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, tela_id 
    FROM public.role_permissoes_telas 
    WHERE role = v_role;
    
    DELETE FROM public.usuario_permissoes_modulos WHERE usuario_id = p_user_id;
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p_user_id, modulo_id 
    FROM public.role_permissoes_modulos 
    WHERE role = v_role;
  ELSE
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, rpt.tela_id
    FROM public.role_permissoes_telas rpt
    WHERE rpt.role = v_role
    ON CONFLICT (usuario_id, tela_id) DO NOTHING;
    
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p_user_id, rpm.modulo_id
    FROM public.role_permissoes_modulos rpm
    WHERE rpm.role = v_role
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
  END IF;
END;
$$