-- Add last_read_at to projeto_membros for unread tracking in chat sidebar
ALTER TABLE public.projeto_membros
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz NOT NULL DEFAULT now();

-- RPC: mark project as read for current user
CREATE OR REPLACE FUNCTION public.rpc_projeto_marcar_lido(p_projeto_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.projeto_membros
     SET last_read_at = now()
   WHERE projeto_id = p_projeto_id
     AND user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_projeto_marcar_lido(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_projeto_marcar_lido(uuid) TO authenticated;