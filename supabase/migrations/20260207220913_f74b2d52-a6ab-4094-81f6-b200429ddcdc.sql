-- Fix INSERT policy on notifications to allow financial users to create notifications for other users
DROP POLICY IF EXISTS "notif_insert" ON public.notifications;

CREATE POLICY "notif_insert"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can insert notifications for themselves
    user_id = auth.uid()
    -- OR user has elevated access (admin, supervisor, gerente, or financial access)
    OR check_user_access(auth.uid())
  );