-- Drop existing permissive policies
DROP POLICY IF EXISTS "Users can manage document links" ON public.china_documento_tarefa_vinculos;
DROP POLICY IF EXISTS "Users can view document links" ON public.china_documento_tarefa_vinculos;
DROP POLICY IF EXISTS "Users can create document links" ON public.china_documento_tarefa_vinculos;
DROP POLICY IF EXISTS "Users can delete document links" ON public.china_documento_tarefa_vinculos;

-- Create aligned RLS policies using check_user_access
CREATE POLICY "Users with china access can view document links"
ON public.china_documento_tarefa_vinculos
FOR SELECT TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica_china'));

CREATE POLICY "Users with china access can create document links"
ON public.china_documento_tarefa_vinculos
FOR INSERT TO authenticated
WITH CHECK (public.check_user_access(auth.uid(), 'fabrica_china'));

CREATE POLICY "Users with china access can update document links"
ON public.china_documento_tarefa_vinculos
FOR UPDATE TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica_china'));

CREATE POLICY "Users with china access can delete document links"
ON public.china_documento_tarefa_vinculos
FOR DELETE TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica_china'));