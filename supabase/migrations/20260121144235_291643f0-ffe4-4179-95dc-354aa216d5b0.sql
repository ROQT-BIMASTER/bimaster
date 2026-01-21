
-- Corrigir política de trade_bank_daily_balances para ser mais restritiva
DROP POLICY IF EXISTS "Allow authenticated users to insert bank daily balances" ON public.trade_bank_daily_balances;

CREATE POLICY "Allow finance users to insert bank daily balances"
ON public.trade_bank_daily_balances FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'supervisor'::app_role)
  OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);
