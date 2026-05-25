-- Encrypt notion_connections.access_token (OAuth token for Notion workspace)
ALTER TABLE public.notion_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- Backfill existing rows
UPDATE public.notion_connections
SET access_token_encrypted = public.encrypt_token(access_token)
WHERE access_token IS NOT NULL AND access_token <> '' AND access_token_encrypted IS NULL;

-- Drop plaintext column
ALTER TABLE public.notion_connections DROP COLUMN IF EXISTS access_token;

-- Safe view for joins/inspection (no token material)
CREATE OR REPLACE VIEW public.notion_connections_safe AS
SELECT id, user_id, workspace_id, workspace_name, workspace_icon, bot_id,
       notion_user_id, notion_user_name, created_at, updated_at,
       (access_token_encrypted IS NOT NULL) AS has_token
FROM public.notion_connections;

-- RPC to fetch decrypted token for the calling user (used by edge functions via service role)
CREATE OR REPLACE FUNCTION public.get_notion_access_token(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT public.decrypt_token(access_token_encrypted)
    INTO v_token
  FROM public.notion_connections
  WHERE user_id = p_user_id
  ORDER BY updated_at DESC
  LIMIT 1;
  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_notion_access_token(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_notion_access_token(UUID) TO service_role;

-- RPC to upsert connection encrypting in-server (no plaintext over the wire to storage)
CREATE OR REPLACE FUNCTION public.upsert_notion_connection(
  p_user_id UUID,
  p_workspace_id TEXT,
  p_workspace_name TEXT,
  p_workspace_icon TEXT,
  p_bot_id TEXT,
  p_access_token TEXT,
  p_notion_user_id TEXT,
  p_notion_user_name TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.notion_connections (
    user_id, workspace_id, workspace_name, workspace_icon, bot_id,
    access_token_encrypted, notion_user_id, notion_user_name, updated_at
  ) VALUES (
    p_user_id, p_workspace_id, p_workspace_name, p_workspace_icon, p_bot_id,
    public.encrypt_token(p_access_token), p_notion_user_id, p_notion_user_name, now()
  )
  ON CONFLICT (user_id, workspace_id) DO UPDATE
  SET workspace_name = EXCLUDED.workspace_name,
      workspace_icon = EXCLUDED.workspace_icon,
      bot_id = EXCLUDED.bot_id,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      notion_user_id = EXCLUDED.notion_user_id,
      notion_user_name = EXCLUDED.notion_user_name,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_notion_connection(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_notion_connection(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;