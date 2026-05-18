-- =========================================================================
-- rpc_china_submissoes_unread — contagem de não-lidas por submissão
-- =========================================================================
--
-- Substitui o fetch client-side de TODAS as mensagens de TODAS as
-- submissões só pra contar `lida_por`. Faz a agregação no banco.
-- Mesma estratégia do PR #16 (refactor de useConversas pra HEAD count).
--
-- Lógica: para cada submissão, conta mensagens onde:
--   - o usuário invocador NÃO é o autor (não conta as próprias)
--   - o usuário invocador NÃO está em `lida_por` (NULL ou ausente do array)
--
-- Retorna apenas submissões com >0 não-lidas (filtra zero no cliente é caro).

CREATE OR REPLACE FUNCTION public.rpc_china_submissoes_unread()
RETURNS TABLE(submissao_id uuid, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH uid AS (SELECT auth.uid() AS id)
  SELECT m.submissao_id, count(*)::int AS total
  FROM public.china_chat_mensagens m, uid
  WHERE uid.id IS NOT NULL
    AND m.usuario_id <> uid.id
    AND NOT (COALESCE(m.lida_por, '[]'::jsonb) @> jsonb_build_array(uid.id::text))
  GROUP BY m.submissao_id;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_china_submissoes_unread() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_china_submissoes_unread() TO authenticated;

COMMENT ON FUNCTION public.rpc_china_submissoes_unread IS
  'Conta mensagens não-lidas por submissão para o usuário atual. Usado pela sidebar
   do /chat no modo Submissões. RLS de china_chat_mensagens controla acesso — a
   função só vê o que o invocador veria.';
