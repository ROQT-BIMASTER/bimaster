
-- 1. contas_receber — filtro por empresa
DROP POLICY IF EXISTS "cr_select_strict" ON public.contas_receber;
CREATE POLICY "cr_select_empresa" ON public.contas_receber
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "cr_update_strict" ON public.contas_receber;
CREATE POLICY "cr_update_empresa" ON public.contas_receber
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

-- 2. financial_payment_queue — filtro por empresa
DROP POLICY IF EXISTS "fpq_select_policy" ON public.financial_payment_queue;
CREATE POLICY "fpq_select_empresa" ON public.financial_payment_queue
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR (
    (has_role(auth.uid(), 'admin'::public.app_role) OR can_access_payment_queue(auth.uid()))
    AND user_has_empresa_access(auth.uid(), empresa_id)
  )
);

DROP POLICY IF EXISTS "fpq_update_restricted" ON public.financial_payment_queue;
CREATE POLICY "fpq_update_empresa" ON public.financial_payment_queue
FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::public.app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'))
  AND user_has_empresa_access(auth.uid(), empresa_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::public.app_role) OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'))
  AND user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "fpq_insert_restricted" ON public.financial_payment_queue;
CREATE POLICY "fpq_insert_empresa" ON public.financial_payment_queue
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::public.app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- 3. bank_connections — restringir por empresa e user
DROP POLICY IF EXISTS "Authenticated users can manage bank_connections" ON public.bank_connections;

CREATE POLICY "bc_select_empresa" ON public.bank_connections
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND user_has_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "bc_insert" ON public.bank_connections
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "bc_update_empresa" ON public.bank_connections
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND user_has_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "bc_delete_empresa" ON public.bank_connections
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND user_has_empresa_access(auth.uid(), empresa_id)
);

-- 4. conciliacoes_bancarias — restringir via join com bank_connections
DROP POLICY IF EXISTS "Authenticated users can manage conciliacoes_bancarias" ON public.conciliacoes_bancarias;

CREATE POLICY "concb_select" ON public.conciliacoes_bancarias
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bank_connections bc
    WHERE bc.id = bank_connection_id
      AND bc.user_id = auth.uid()
      AND user_has_empresa_access(auth.uid(), bc.empresa_id)
  )
);

CREATE POLICY "concb_insert" ON public.conciliacoes_bancarias
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bank_connections bc
    WHERE bc.id = bank_connection_id AND bc.user_id = auth.uid()
  )
);

CREATE POLICY "concb_update" ON public.conciliacoes_bancarias
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bank_connections bc
    WHERE bc.id = bank_connection_id
      AND bc.user_id = auth.uid()
      AND user_has_empresa_access(auth.uid(), bc.empresa_id)
  )
);

CREATE POLICY "concb_delete" ON public.conciliacoes_bancarias
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bank_connections bc
    WHERE bc.id = bank_connection_id
      AND bc.user_id = auth.uid()
  )
);
