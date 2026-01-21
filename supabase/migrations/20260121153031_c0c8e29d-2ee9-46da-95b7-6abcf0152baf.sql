
-- =====================================================
-- SECURITY HARDENING: clientes and fabrica_notas_fiscais tables
-- =====================================================

-- =====================================================
-- PART 1: Fix clientes table - Remove duplicate policies and create masked view
-- =====================================================

-- Drop all duplicate/overlapping SELECT policies on clientes
DROP POLICY IF EXISTS "Users can view clientes based on modules" ON public.clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem ler clientes" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_by_role" ON public.clientes;
DROP POLICY IF EXISTS "Admin e supervisor acessam todos clientes" ON public.clientes;

-- Create a function to check if user can access client data
CREATE OR REPLACE FUNCTION public.can_access_cliente(viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role app_role;
BEGIN
  -- Get viewer's role
  SELECT role INTO viewer_role
  FROM user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Admins and supervisors have full access
  IF viewer_role IN ('admin', 'supervisor') THEN
    RETURN true;
  END IF;
  
  -- Check if user has specific module access (more restrictive)
  -- Only users with vendas module can access clients
  IF usuario_tem_acesso_modulo(viewer_id, 'vendas') THEN
    RETURN true;
  END IF;
  
  -- Financeiro users get limited access (via masked view)
  -- They should use clientes_safe view instead
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_cliente IS 'Security function: Controls cliente data access. Admins/supervisors see all, vendas module users see all, financeiro uses masked view.';

-- Create single, clear SELECT policy for clientes (full access)
CREATE POLICY "clientes_select_authorized"
ON public.clientes FOR SELECT
TO authenticated
USING (can_access_cliente(auth.uid()));

-- Keep existing INSERT/UPDATE/DELETE policies as they are already restrictive

-- Create a SECURE MASKED VIEW for financeiro users
-- This view masks sensitive contact information
CREATE OR REPLACE VIEW public.clientes_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  codigo,
  empresa_id,
  nome,
  nome_abreviado,
  cnpj,
  -- Mask email: show only domain
  CASE 
    WHEN email IS NOT NULL AND email != '' 
    THEN CONCAT('***@', SPLIT_PART(email, '@', 2))
    ELSE NULL 
  END as email_masked,
  -- Mask phone: show only last 4 digits
  CASE 
    WHEN telefone IS NOT NULL AND LENGTH(telefone) > 4 
    THEN CONCAT('***-', RIGHT(telefone, 4))
    ELSE NULL 
  END as telefone_masked,
  -- Mask mobile: show only last 4 digits
  CASE 
    WHEN celular IS NOT NULL AND LENGTH(celular) > 4 
    THEN CONCAT('***-', RIGHT(celular, 4))
    ELSE NULL 
  END as celular_masked,
  -- Mask address: show only city and state
  cidade,
  uf,
  -- Financial data (needed for financeiro)
  limite_credito,
  classificacao,
  conceito,
  status_bloqueio,
  data_ultima_compra,
  valor_ultima_compra,
  data_maior_compra,
  valor_maior_compra,
  created_at,
  updated_at
FROM public.clientes
WHERE (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'supervisor') OR
  usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR
  usuario_tem_acesso_modulo(auth.uid(), 'comercial') OR
  usuario_tem_acesso_modulo(auth.uid(), 'cobranca')
);

REVOKE ALL ON public.clientes_safe FROM anon;
GRANT SELECT ON public.clientes_safe TO authenticated;

COMMENT ON VIEW public.clientes_safe IS 'Masked view of clientes table. Email, phone and address are masked for privacy. Use this for financeiro/comercial modules.';

-- =====================================================
-- PART 2: Fix fabrica_notas_fiscais table - Remove overly permissive policy
-- =====================================================

-- Drop the dangerous policy that allows ALL authenticated users
DROP POLICY IF EXISTS "Usuários autenticados podem ver notas fiscais" ON public.fabrica_notas_fiscais;

-- Drop duplicate policies
DROP POLICY IF EXISTS "Factory and finance can view invoices" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver notas" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Usuários com permissão fabrica gerenciam notas" ON public.fabrica_notas_fiscais;

-- Create a function to check invoice access
CREATE OR REPLACE FUNCTION public.can_access_notas_fiscais(viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role app_role;
BEGIN
  -- Get viewer's role
  SELECT role INTO viewer_role
  FROM user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Only admins have unrestricted access
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Supervisors with fabrica or financeiro module access
  IF viewer_role = 'supervisor' THEN
    IF usuario_tem_acesso_modulo(viewer_id, 'fabrica') OR 
       usuario_tem_acesso_modulo(viewer_id, 'financeiro') THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Regular users need explicit fabrica module access
  IF usuario_tem_acesso_modulo(viewer_id, 'fabrica') THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_access_notas_fiscais IS 'Security function: Controls invoice access. Admins see all, supervisors with fabrica/financeiro see all, users need fabrica module.';

-- Create strict SELECT policy
CREATE POLICY "notas_fiscais_select_authorized"
ON public.fabrica_notas_fiscais FOR SELECT
TO authenticated
USING (can_access_notas_fiscais(auth.uid()));

-- Create strict INSERT policy - only fabrica users
CREATE POLICY "notas_fiscais_insert_fabrica"
ON public.fabrica_notas_fiscais FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin') OR
  usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

-- Create strict UPDATE policy - only fabrica users
CREATE POLICY "notas_fiscais_update_fabrica"
ON public.fabrica_notas_fiscais FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR
  usuario_tem_acesso_modulo(auth.uid(), 'fabrica')
);

-- Create strict DELETE policy - only admins
CREATE POLICY "notas_fiscais_delete_admin"
ON public.fabrica_notas_fiscais FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Drop old policies that might conflict
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Factory can insert invoices" ON public.fabrica_notas_fiscais;
DROP POLICY IF EXISTS "Factory can update invoices" ON public.fabrica_notas_fiscais;

-- =====================================================
-- PART 3: Add audit logging for sensitive table access
-- =====================================================

-- Create audit trigger for clientes access
DROP TRIGGER IF EXISTS audit_clientes_changes ON public.clientes;
CREATE TRIGGER audit_clientes_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();

-- Create audit trigger for notas fiscais access
DROP TRIGGER IF EXISTS audit_notas_fiscais_changes ON public.fabrica_notas_fiscais;
CREATE TRIGGER audit_notas_fiscais_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.fabrica_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION audit_sensitive_access();
