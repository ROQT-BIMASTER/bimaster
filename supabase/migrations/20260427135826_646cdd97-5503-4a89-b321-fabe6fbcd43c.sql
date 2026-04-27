-- Recreate UPDATE policy with both USING and WITH CHECK so PostgREST .select() after .update() returns the affected row reliably
DROP POLICY IF EXISTS fp_update ON public.fabrica_produtos;

CREATE POLICY fp_update
ON public.fabrica_produtos
FOR UPDATE
TO authenticated
USING (public.check_user_access(auth.uid(), 'fabrica'))
WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));