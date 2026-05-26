-- Tabela usada exclusivamente pelas edge functions notion-oauth-start/callback
-- via SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). Nenhum cliente autenticado ou
-- anônimo deve ler/escrever. Adiciona policy explicitamente restritiva para
-- satisfazer o linter (RLS habilitado sem policy) e tornar o intent explícito.
CREATE POLICY "Deny all access to notion_oauth_states"
  ON public.notion_oauth_states
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);