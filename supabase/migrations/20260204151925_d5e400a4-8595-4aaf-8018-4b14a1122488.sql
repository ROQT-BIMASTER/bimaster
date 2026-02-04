-- Primeiro, dropar a função existente (com qualquer assinatura)
DROP FUNCTION IF EXISTS public.sincronizar_permissoes_usuario(uuid);
DROP FUNCTION IF EXISTS public.sincronizar_permissoes_usuario(uuid, boolean);

-- Fase 1.1: Recriar a função com modo "suave" que preserva customizações
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes_usuario(
  p_user_id uuid,
  p_force_sync boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
  v_role app_role;
BEGIN
  -- Buscar o role atual do usuário
  SELECT role INTO v_role
  FROM public.user_roles 
  WHERE user_id = p_user_id 
  LIMIT 1;

  -- Admins não precisam de permissões individuais
  IF v_role = 'admin' THEN 
    RETURN; 
  END IF;

  IF p_force_sync THEN
    -- Sincronização forçada: deleta e recria (usado apenas quando explicitamente solicitado)
    DELETE FROM public.usuario_permissoes_telas WHERE usuario_id = p_user_id;
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, tela_id 
    FROM public.role_permissoes_telas 
    WHERE role = v_role;
    
    -- Também sincroniza módulos quando forçado
    DELETE FROM public.usuario_permissoes_modulos WHERE usuario_id = p_user_id;
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p_user_id, modulo_id 
    FROM public.role_permissoes_modulos 
    WHERE role = v_role;
  ELSE
    -- Sincronização suave: apenas adiciona permissões que estão faltando (NÃO deleta as existentes)
    INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
    SELECT p_user_id, rpt.tela_id
    FROM public.role_permissoes_telas rpt
    WHERE rpt.role = v_role
    ON CONFLICT (usuario_id, tela_id) DO NOTHING;
    
    -- Também adiciona módulos faltantes
    INSERT INTO public.usuario_permissoes_modulos (usuario_id, modulo_id)
    SELECT p_user_id, rpm.modulo_id
    FROM public.role_permissoes_modulos rpm
    WHERE rpm.role = v_role
    ON CONFLICT (usuario_id, modulo_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Fase 1.2: Dropar e recriar o trigger e sua função
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
DROP FUNCTION IF EXISTS public.trigger_sincronizar_permissoes();

CREATE OR REPLACE FUNCTION public.trigger_sincronizar_permissoes()
RETURNS trigger AS $$
BEGIN
  -- Só sincroniza se:
  -- 1. É INSERT (novo usuário) - adiciona permissões padrão do role
  -- 2. Ou é UPDATE e o role REALMENTE mudou - adiciona novas permissões do novo role
  IF TG_OP = 'INSERT' THEN
    -- Novo usuário: adiciona permissões padrão do role (modo suave)
    PERFORM public.sincronizar_permissoes_usuario(NEW.user_id, false);
  ELSIF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    -- Role mudou: adiciona permissões do novo role (modo suave, preserva customizações)
    PERFORM public.sincronizar_permissoes_usuario(NEW.user_id, false);
  END IF;
  -- Se o role não mudou, não faz nada - preserva permissões customizadas
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Criar o trigger
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sincronizar_permissoes();

-- Adicionar comentários para documentação
COMMENT ON FUNCTION public.sincronizar_permissoes_usuario IS 
'Sincroniza permissões do usuário com base no role. 
- force_sync=false (padrão): Apenas ADICIONA permissões faltantes, preservando customizações.
- force_sync=true: Reseta para o padrão do role, removendo customizações.';

COMMENT ON FUNCTION public.trigger_sincronizar_permissoes IS 
'Trigger que sincroniza permissões automaticamente.
- Em INSERT: adiciona permissões padrão do role.
- Em UPDATE: só sincroniza se o role realmente mudou.
- Nunca deleta permissões customizadas automaticamente.';