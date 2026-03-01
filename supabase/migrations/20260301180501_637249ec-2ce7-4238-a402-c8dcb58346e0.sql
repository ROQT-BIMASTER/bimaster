
-- Fix overly permissive RLS on fabrica_produto_grade_itens
-- Restrict to users with fabrica module access

DROP POLICY IF EXISTS "Authenticated users can insert grade items" ON public.fabrica_produto_grade_itens;
DROP POLICY IF EXISTS "Authenticated users can update grade items" ON public.fabrica_produto_grade_itens;
DROP POLICY IF EXISTS "Authenticated users can delete grade items" ON public.fabrica_produto_grade_itens;

CREATE POLICY "fabrica_grade_itens_insert"
ON public.fabrica_produto_grade_itens FOR INSERT
TO authenticated
WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'::text));

CREATE POLICY "fabrica_grade_itens_update"
ON public.fabrica_produto_grade_itens FOR UPDATE
TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica'::text));

CREATE POLICY "fabrica_grade_itens_delete"
ON public.fabrica_produto_grade_itens FOR DELETE
TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica'::text));
