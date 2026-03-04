
-- Fix broken ftp_delete policy (was calling check_user_access with 1 arg instead of 2)
DROP POLICY IF EXISTS ftp_delete ON public.fabrica_tabelas_preco;
CREATE POLICY ftp_delete ON public.fabrica_tabelas_preco
  FOR DELETE TO authenticated
  USING (check_user_access(auth.uid(), 'fabrica'));

-- Allow users with 'precos' module access to SELECT price tables
CREATE POLICY ftp_select_precos ON public.fabrica_tabelas_preco
  FOR SELECT TO authenticated
  USING (check_user_access(auth.uid(), 'precos'));
