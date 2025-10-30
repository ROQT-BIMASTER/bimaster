-- ============================================
-- PARTE 2: FUNÇÕES DE SEGURANÇA E HIERARQUIA (corrigido)
-- ============================================

-- 1. Corrigir função has_role com search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. Corrigir função is_admin_or_supervisor com search_path
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'supervisor')
  )
$$;

-- 3. Nova função: verifica se usuário tem role específico ou superior na hierarquia
CREATE OR REPLACE FUNCTION public.has_role_or_higher(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
  role_hierarchy INTEGER;
  min_role_hierarchy INTEGER;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  role_hierarchy := CASE user_role
    WHEN 'admin' THEN 1
    WHEN 'supervisor' THEN 2
    WHEN 'vendedor' THEN 3
    WHEN 'promotor' THEN 4
    ELSE 99
  END;
  
  min_role_hierarchy := CASE _min_role
    WHEN 'admin' THEN 1
    WHEN 'supervisor' THEN 2
    WHEN 'vendedor' THEN 3
    WHEN 'promotor' THEN 4
    ELSE 99
  END;
  
  RETURN role_hierarchy <= min_role_hierarchy;
END;
$$;

-- 4. Função para verificar se usuário é vendedor ou promotor
CREATE OR REPLACE FUNCTION public.is_sales_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('vendedor', 'promotor')
  )
$$;

-- 5. Corrigir função usuario_tem_permissao_tela
CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_tela(_user_id uuid, _tela_codigo text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_permissoes_telas upt
    JOIN public.telas_sistema ts ON upt.tela_id = ts.id
    WHERE upt.usuario_id = _user_id
    AND ts.codigo = _tela_codigo
    AND ts.ativo = true
  ) OR has_role(_user_id, 'admin');
$$;

-- 6. Corrigir função usuario_tem_acesso_prospect
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_prospect(_user_id uuid, _prospect_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_prospects
    WHERE usuario_id = _user_id
    AND prospect_id = _prospect_id
  ) OR is_admin_or_supervisor(_user_id);
$$;

-- 7. Corrigir função is_participant_of_conversa
CREATE OR REPLACE FUNCTION public.is_participant_of_conversa(conversa_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversas_participantes
    WHERE conversa_id = conversa_id_param
    AND usuario_id = user_id_param
  );
$$;

-- 8. Atualizar handle_new_user para suportar promotor
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo_usuario text;
  v_role app_role;
  v_aprovado boolean;
BEGIN
  v_tipo_usuario := COALESCE(NEW.raw_user_meta_data->>'tipo_usuario', 'vendedor');
  
  v_role := CASE v_tipo_usuario
    WHEN 'admin' THEN 'admin'::app_role
    WHEN 'supervisor' THEN 'supervisor'::app_role
    WHEN 'promotor' THEN 'promotor'::app_role
    ELSE 'vendedor'::app_role
  END;
  
  v_aprovado := (v_role = 'admin');
  
  INSERT INTO public.profiles (id, nome, email, aprovado)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Novo Usuário'),
    NEW.email,
    v_aprovado
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 9. Atualizar trigger_sincronizar_permissoes
CREATE OR REPLACE FUNCTION public.trigger_sincronizar_permissoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.sincronizar_permissoes_usuario(NEW.user_id);
  RETURN NEW;
END;
$$;

-- 10. Policy: Apenas admins podem gerenciar user_roles
DROP POLICY IF EXISTS "Apenas admins gerenciam roles" ON public.user_roles;
CREATE POLICY "Apenas admins gerenciam roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 11. Policy: Todos podem ver seus próprios roles
DROP POLICY IF EXISTS "Usuários veem próprio role" ON public.user_roles;
CREATE POLICY "Usuários veem próprio role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- 12. Comentários
COMMENT ON FUNCTION public.has_role_or_higher IS 'Verifica se usuário tem role igual ou superior na hierarquia: admin > supervisor > vendedor > promotor';
COMMENT ON FUNCTION public.is_sales_team IS 'Verifica se usuário é vendedor ou promotor (time de vendas)';