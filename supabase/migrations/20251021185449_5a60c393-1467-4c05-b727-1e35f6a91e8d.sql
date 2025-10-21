-- Criar tabela de permissões por role (templates de permissão)
CREATE TABLE IF NOT EXISTS public.role_permissoes_telas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  tela_id UUID NOT NULL REFERENCES public.telas_sistema(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, tela_id)
);

-- Habilitar RLS
ALTER TABLE public.role_permissoes_telas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin pode gerenciar permissões de roles"
  ON public.role_permissoes_telas
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Todos podem visualizar permissões de roles"
  ON public.role_permissoes_telas
  FOR SELECT
  TO authenticated
  USING (true);

-- Popular permissões padrão para SUPERVISOR
-- Supervisores têm acesso a módulos de gestão e visualização
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'supervisor', id FROM public.telas_sistema 
WHERE codigo IN (
  'dashboard',
  'prospects', 
  'kanban',
  'mapa',
  'atividades',
  'tarefas',
  'chat',
  'ranking',
  'trade_marketing',
  'trade_stores',
  'trade_visits',
  'trade_photos',
  'trade_competitors',
  'trade_insights',
  'configuracoes'
)
ON CONFLICT (role, tela_id) DO NOTHING;

-- Popular permissões padrão para VENDEDOR
-- Vendedores têm acesso limitado a módulos operacionais
INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'vendedor', id FROM public.telas_sistema 
WHERE codigo IN (
  'dashboard',
  'prospects',
  'kanban',
  'mapa',
  'atividades',
  'tarefas',
  'chat',
  'trade_marketing',
  'trade_stores',
  'trade_visits',
  'trade_photos',
  'configuracoes'
)
ON CONFLICT (role, tela_id) DO NOTHING;

-- Função para sincronizar permissões de usuário baseado no role
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes_usuario(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  -- Buscar role do usuário
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se for admin, não precisa de permissões individuais
  IF v_role = 'admin' THEN
    RETURN;
  END IF;

  -- Deletar permissões antigas do usuário
  DELETE FROM public.usuario_permissoes_telas
  WHERE usuario_id = p_user_id;

  -- Inserir permissões baseadas no role
  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT p_user_id, tela_id
  FROM public.role_permissoes_telas
  WHERE role = v_role;
END;
$$;

-- Trigger para sincronizar permissões automaticamente quando role é atribuído
CREATE OR REPLACE FUNCTION public.trigger_sincronizar_permissoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sincronizar_permissoes_usuario(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_sincronizar_permissoes();

-- Sincronizar permissões de todos os usuários existentes
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN SELECT DISTINCT user_id FROM public.user_roles WHERE role != 'admin'
  LOOP
    PERFORM public.sincronizar_permissoes_usuario(v_user_record.user_id);
  END LOOP;
END $$;