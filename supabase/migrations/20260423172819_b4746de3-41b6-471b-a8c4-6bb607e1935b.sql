-- Hardening Realtime: garantir RLS forçada e cobrir todas as operações
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime.messages FORCE ROW LEVEL SECURITY;

-- Limpar policies antigas (recriadas com nomes versionados v2)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='realtime' AND tablename='messages'
             AND policyname NOT ILIKE '%v2%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON realtime.messages', p.policyname);
  END LOOP;
END $$;

-- service_role: acesso total (servidor publica broadcasts)
CREATE POLICY "realtime service_role full v2"
ON realtime.messages
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- authenticated: apenas tópicos próprios (<uid> ou <uid>:*)
CREATE POLICY "realtime authenticated select own topic v2"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  )
);

CREATE POLICY "realtime authenticated insert own topic v2"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  )
);

CREATE POLICY "realtime authenticated update own topic v2"
ON realtime.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  )
);

CREATE POLICY "realtime authenticated delete own topic v2"
ON realtime.messages
FOR DELETE
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() = auth.uid()::text
    OR realtime.topic() LIKE auth.uid()::text || ':%'
  )
);