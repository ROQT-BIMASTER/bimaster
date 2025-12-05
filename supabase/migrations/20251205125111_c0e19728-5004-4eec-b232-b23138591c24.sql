-- =============================================
-- SECURITY FIX: Restrict user_roles SELECT policy
-- =============================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "Acesso total user_roles - SELECT" ON user_roles;

-- Create restricted policy - users can only see their own role
CREATE POLICY "Usuários veem próprio role ou admin vê todos"
ON user_roles FOR SELECT
USING (
  user_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);

-- =============================================
-- SECURITY FIX: Add SET search_path to functions
-- =============================================

-- Fix update_whatsapp_conversations_updated_at
CREATE OR REPLACE FUNCTION public.update_whatsapp_conversations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix log_changes function
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSE
    INSERT INTO public.etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$;

-- =============================================
-- SECURITY FIX: Tighten prospects RLS policy
-- =============================================

-- Drop existing permissive policy for usuario_prospects access
DROP POLICY IF EXISTS "Vendedores veem prospects atribuídos ou compartilhados" ON prospects;

-- Create more restrictive policy - only owner, directly assigned, or admin/supervisor
CREATE POLICY "Vendedores veem prospects atribuídos ou compartilhados"
ON prospects FOR SELECT
USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM usuario_prospects up
    WHERE up.prospect_id = prospects.id 
    AND up.usuario_id = auth.uid()
  )
);

-- Add policy to restrict who can share prospects via usuario_prospects
DROP POLICY IF EXISTS "Usuários podem criar compartilhamento de prospects" ON usuario_prospects;

CREATE POLICY "Somente dono ou admin pode compartilhar prospects"
ON usuario_prospects FOR INSERT
WITH CHECK (
  is_admin_or_supervisor(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM prospects p
    WHERE p.id = prospect_id
    AND p.vendedor_id = auth.uid()
  )
);

-- =============================================
-- SECURITY FIX: Storage buckets RLS verification
-- =============================================

-- Ensure storage.objects has proper RLS for trade-photos bucket
DROP POLICY IF EXISTS "Authenticated users can view trade photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload trade photos" ON storage.objects;

-- Only users with trade module permission can access trade photos
CREATE POLICY "Usuários trade podem ver fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trade-photos' AND
  (is_admin_or_supervisor(auth.uid()) OR usuario_tem_permissao_modulo(auth.uid(), 'trade'))
);

CREATE POLICY "Usuários trade podem fazer upload de fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'trade-photos' AND
  (is_admin_or_supervisor(auth.uid()) OR usuario_tem_permissao_modulo(auth.uid(), 'trade'))
);

CREATE POLICY "Usuários trade podem atualizar suas fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'trade-photos' AND
  (is_admin_or_supervisor(auth.uid()) OR usuario_tem_permissao_modulo(auth.uid(), 'trade'))
);

CREATE POLICY "Admins podem deletar fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'trade-photos' AND
  is_admin_or_supervisor(auth.uid())
);