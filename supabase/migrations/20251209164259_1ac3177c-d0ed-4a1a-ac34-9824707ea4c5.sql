-- Fix trade_rewards: require authentication for reading
DROP POLICY IF EXISTS "Todos podem ver recompensas ativas" ON public.trade_rewards;
CREATE POLICY "Authenticated users can view active rewards" ON public.trade_rewards
FOR SELECT USING (
  auth.uid() IS NOT NULL AND is_active = true
);