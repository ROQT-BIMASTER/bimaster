
-- Fix marketing_user_stats: scope SELECT to own data
DROP POLICY IF EXISTS "Authenticated users can view stats" ON public.marketing_user_stats;
CREATE POLICY "Users can view own stats"
  ON public.marketing_user_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix marketing_user_stats: UPDATE should be authenticated only
DROP POLICY IF EXISTS "Users can update own stats" ON public.marketing_user_stats;
CREATE POLICY "Users can update own stats"
  ON public.marketing_user_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add admin override for viewing all stats
CREATE POLICY "Admins can view all stats"
  ON public.marketing_user_stats FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
