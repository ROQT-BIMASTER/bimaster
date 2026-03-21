
-- 1. Enable RLS on the 3 tables
ALTER TABLE public.parcelas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_conta_corrente ENABLE ROW LEVEL SECURITY;

-- 2. Revoke anon access
REVOKE ALL ON public.parcelas_receber FROM anon;
REVOKE ALL ON public.recebimentos FROM anon;
REVOKE ALL ON public.lancamentos_conta_corrente FROM anon;

-- 3. Policies for parcelas_receber
CREATE POLICY "fin_select_parcelas_receber" ON public.parcelas_receber
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_insert_parcelas_receber" ON public.parcelas_receber
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_update_parcelas_receber" ON public.parcelas_receber
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

-- 4. Policies for recebimentos
CREATE POLICY "fin_select_recebimentos" ON public.recebimentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_insert_recebimentos" ON public.recebimentos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_update_recebimentos" ON public.recebimentos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

-- 5. Policies for lancamentos_conta_corrente
CREATE POLICY "fin_select_lancamentos_cc" ON public.lancamentos_conta_corrente
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_insert_lancamentos_cc" ON public.lancamentos_conta_corrente
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));

CREATE POLICY "fin_update_lancamentos_cc" ON public.lancamentos_conta_corrente
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'));
