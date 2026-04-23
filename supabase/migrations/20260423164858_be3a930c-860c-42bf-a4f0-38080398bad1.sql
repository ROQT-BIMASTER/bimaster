-- Defense-in-depth for Supabase Realtime.
--
-- Background:
--   The only table currently published to supabase_realtime is
--   public.user_central_preferences, which already has strict RLS
--   (auth.uid() = user_id). So Postgres CDC payloads are safe.
--
-- However, the Realtime "messages" table (used by the Broadcast and
-- Presence APIs) had no RLS policies, meaning any authenticated client
-- could open and listen on arbitrary channel topics. This migration
-- closes that gap by enabling RLS and requiring topics to be prefixed
-- with the caller's own auth.uid().
--
-- Allowed topic shapes for an end user:
--   "<uid>"             e.g. "5b1f...e7"
--   "<uid>:<anything>"  e.g. "5b1f...e7:notifications"
--
-- postgres_changes subscriptions are NOT gated by realtime.messages
-- policies, so existing app channels using postgres_changes (the only
-- pattern in the codebase) keep working. service_role bypasses RLS.
--
-- Idempotent on RLS-enable; policies are dropped first to allow re-runs.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_authenticated_select_own_topic" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_authenticated_insert_own_topic" ON realtime.messages;

CREATE POLICY "realtime_authenticated_select_own_topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      topic = auth.uid()::text
      OR topic LIKE auth.uid()::text || ':%'
    )
  );

CREATE POLICY "realtime_authenticated_insert_own_topic"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      topic = auth.uid()::text
      OR topic LIKE auth.uid()::text || ':%'
    )
  );