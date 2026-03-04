
-- Fix broken fp_delete policy on fabrica_produtos
DROP POLICY IF EXISTS fp_delete ON public.fabrica_produtos;
CREATE POLICY fp_delete ON public.fabrica_produtos
  FOR DELETE TO authenticated
  USING (check_user_access(auth.uid(), 'fabrica'));

-- Add SELECT for 'precos' module on fabrica_produtos
CREATE POLICY fp_select_precos ON public.fabrica_produtos
  FOR SELECT TO authenticated
  USING (check_user_access(auth.uid(), 'precos'));

-- Fix broken fpp_delete policy on fabrica_precos_produtos
DROP POLICY IF EXISTS fpp_delete ON public.fabrica_precos_produtos;
CREATE POLICY fpp_delete ON public.fabrica_precos_produtos
  FOR DELETE TO authenticated
  USING (check_user_access(auth.uid(), 'fabrica'));

-- Add SELECT for 'precos' module on fabrica_precos_produtos
CREATE POLICY fpp_select_precos ON public.fabrica_precos_produtos
  FOR SELECT TO authenticated
  USING (check_user_access(auth.uid(), 'precos'));
