-- Adicionar campos de hierarquia na tabela stores
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS vendedor_id UUID,
ADD COLUMN IF NOT EXISTS supervisor_id UUID;

-- Criar função para verificar se um usuário é supervisor de outro
CREATE OR REPLACE FUNCTION public.is_supervisor_of(_supervisor_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Verifica se o supervisor_id está na hierarquia acima do user_id
  RETURN EXISTS (
    WITH RECURSIVE hierarchy AS (
      -- Começar com o usuário
      SELECT id, supervisor_id
      FROM profiles
      WHERE id = _user_id
      
      UNION ALL
      
      -- Subir na hierarquia
      SELECT p.id, p.supervisor_id
      FROM profiles p
      INNER JOIN hierarchy h ON p.id = h.supervisor_id
    )
    SELECT 1 FROM hierarchy WHERE id = _supervisor_id
  );
END;
$$;

-- Criar função para obter todos os subordinados de um usuário (diretos e indiretos)
CREATE OR REPLACE FUNCTION public.get_subordinados(_user_id uuid)
RETURNS TABLE(subordinado_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    -- Começar com o usuário
    SELECT id
    FROM profiles
    WHERE supervisor_id = _user_id
    
    UNION ALL
    
    -- Descer na hierarquia
    SELECT p.id
    FROM profiles p
    INNER JOIN hierarchy h ON p.supervisor_id = h.id
  )
  SELECT id FROM hierarchy;
END;
$$;

-- Criar função para verificar se usuário tem acesso a uma loja
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_loja(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_vendedor_id uuid;
  v_supervisor_id uuid;
  v_user_role app_role;
BEGIN
  -- Buscar vendedor e supervisor da loja
  SELECT vendedor_id, supervisor_id INTO v_vendedor_id, v_supervisor_id
  FROM stores
  WHERE id = _store_id;
  
  -- Buscar role do usuário
  SELECT role INTO v_user_role
  FROM user_roles
  WHERE user_id = _user_id
  LIMIT 1;
  
  -- Admin vê tudo
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Supervisor vê lojas dele e de seus subordinados
  IF v_user_role = 'supervisor' THEN
    -- Se a loja está vinculada a ele diretamente
    IF v_supervisor_id = _user_id THEN
      RETURN true;
    END IF;
    
    -- Se a loja está vinculada a um vendedor subordinado
    IF v_vendedor_id IS NOT NULL AND is_supervisor_of(_user_id, v_vendedor_id) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Vendedor/Promotor vê apenas suas próprias lojas
  IF v_vendedor_id = _user_id THEN
    RETURN true;
  END IF;
  
  -- Se foi criado por ele
  IF EXISTS (SELECT 1 FROM stores WHERE id = _store_id AND created_by = _user_id) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Atualizar RLS policies da tabela stores
DROP POLICY IF EXISTS "Usuários autenticados podem criar lojas" ON stores;
DROP POLICY IF EXISTS "Usuários autenticados podem ver lojas" ON stores;
DROP POLICY IF EXISTS "Criadores podem atualizar suas lojas" ON stores;
DROP POLICY IF EXISTS "Apenas admins podem deletar lojas" ON stores;

-- Nova policy para INSERT - requer vendedor_id
CREATE POLICY "Usuários podem criar lojas com vinculação" ON stores
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  vendedor_id IS NOT NULL
);

-- Nova policy para SELECT - acesso baseado em hierarquia
CREATE POLICY "Usuários veem lojas conforme hierarquia" ON stores
FOR SELECT
TO authenticated
USING (
  usuario_tem_acesso_loja(auth.uid(), id)
);

-- Nova policy para UPDATE - acesso baseado em hierarquia
CREATE POLICY "Usuários atualizam lojas conforme hierarquia" ON stores
FOR UPDATE
TO authenticated
USING (
  usuario_tem_acesso_loja(auth.uid(), id)
);

-- Nova policy para DELETE - apenas admins e supervisores da loja
CREATE POLICY "Admins e supervisores podem deletar lojas" ON stores
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'supervisor') AND supervisor_id = auth.uid())
);

-- Adicionar campos de hierarquia em visits
ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS vendedor_id UUID,
ADD COLUMN IF NOT EXISTS supervisor_id UUID;

-- Atualizar RLS policies de visits para usar hierarquia
DROP POLICY IF EXISTS "Usuários podem criar visitas" ON visits;
DROP POLICY IF EXISTS "Usuários podem ver próprias visitas" ON visits;
DROP POLICY IF EXISTS "Criadores podem atualizar suas visitas" ON visits;
DROP POLICY IF EXISTS "Apenas admins podem deletar visitas" ON visits;

CREATE POLICY "Usuários podem criar visitas com vinculação" ON visits
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  vendedor_id IS NOT NULL
);

CREATE POLICY "Usuários veem visitas conforme hierarquia" ON visits
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  (vendedor_id IS NOT NULL AND (
    vendedor_id = auth.uid() OR
    is_supervisor_of(auth.uid(), vendedor_id)
  ))
);

CREATE POLICY "Usuários atualizam visitas conforme hierarquia" ON visits
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  (vendedor_id IS NOT NULL AND is_supervisor_of(auth.uid(), vendedor_id))
);

CREATE POLICY "Admins e supervisores podem deletar visitas" ON visits
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  (has_role(auth.uid(), 'supervisor') AND 
   (vendedor_id IS NOT NULL AND is_supervisor_of(auth.uid(), vendedor_id)))
);

-- Adicionar campos de hierarquia em sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS vendedor_id UUID,
ADD COLUMN IF NOT EXISTS supervisor_id UUID;

-- Atualizar RLS de sales
DROP POLICY IF EXISTS "Usuários podem criar vendas" ON sales;
DROP POLICY IF EXISTS "Usuários podem ver próprias vendas" ON sales;
DROP POLICY IF EXISTS "Criadores podem atualizar suas vendas" ON sales;
DROP POLICY IF EXISTS "Apenas admins podem deletar vendas" ON sales;

CREATE POLICY "Usuários podem criar vendas" ON sales
FOR INSERT
TO authenticated
WITH CHECK (
  (salesperson_id = auth.uid() OR created_by = auth.uid()) AND
  vendedor_id IS NOT NULL
);

CREATE POLICY "Usuários veem vendas conforme hierarquia" ON sales
FOR SELECT
TO authenticated
USING (
  salesperson_id = auth.uid() OR 
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  (vendedor_id IS NOT NULL AND (
    vendedor_id = auth.uid() OR
    is_supervisor_of(auth.uid(), vendedor_id)
  ))
);

CREATE POLICY "Usuários atualizam vendas conforme hierarquia" ON sales
FOR UPDATE
TO authenticated
USING (
  salesperson_id = auth.uid() OR 
  created_by = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  (vendedor_id IS NOT NULL AND is_supervisor_of(auth.uid(), vendedor_id))
);

CREATE POLICY "Admins podem deletar vendas" ON sales
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));