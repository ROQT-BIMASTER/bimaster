-- =========================================================================
-- Pesquisa global no chat corporativo (FTS)
-- =========================================================================
--
-- Permite buscar texto em todas as mensagens das conversas em que o user
-- é participante ativo. Implementação:
--
-- 1) Coluna gerada `search_vector` em `mensagens` — to_tsvector('portuguese',
--    conteudo). Sempre atualizada pelo Postgres a cada INSERT/UPDATE; sem
--    trigger custom necessário (GENERATED ALWAYS).
--
-- 2) Índice GIN no search_vector para busca FTS rápida (`@@`).
--
-- 3) RPC `rpc_chat_search(p_query)` — SECURITY DEFINER que respeita a
--    participação do user via JOIN com `conversas_participantes`. Retorna
--    mensagens + conversa_id + headline (snippet com highlight) para a UI
--    poder destacar o match.

-- ---------------------------------------------------------------------------
-- 1) Coluna gerada + index
-- ---------------------------------------------------------------------------

ALTER TABLE public.mensagens
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(conteudo, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_mensagens_search_vector
  ON public.mensagens USING GIN (search_vector);

-- ---------------------------------------------------------------------------
-- 2) RPC de busca
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_chat_search(
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE(
  id            uuid,
  conversa_id   uuid,
  remetente_id  uuid,
  conteudo      text,
  headline      text,
  tipo          text,
  created_at    timestamptz,
  rank          real
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q   tsquery;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN; -- query muito curta: retorna vazio
  END IF;

  -- websearch_to_tsquery tolera frases entre aspas, OR, exclusão "-x" etc.
  -- Mais robusto que plainto_tsquery (rejeita pontuação errada).
  v_q := websearch_to_tsquery('portuguese', p_query);

  RETURN QUERY
  SELECT
    m.id,
    m.conversa_id,
    m.remetente_id,
    m.conteudo,
    ts_headline(
      'portuguese',
      coalesce(m.conteudo, ''),
      v_q,
      'StartSel=<<,StopSel=>>,MaxFragments=2,MinWords=4,MaxWords=18'
    ) AS headline,
    m.tipo,
    m.created_at,
    ts_rank(m.search_vector, v_q) AS rank
  FROM public.mensagens m
  JOIN public.conversas_participantes cp
    ON cp.conversa_id = m.conversa_id
   AND cp.usuario_id  = v_uid
   AND cp.saiu_em IS NULL
  WHERE m.search_vector @@ v_q
    AND COALESCE(m.excluida_para_todos, false) = false
  ORDER BY rank DESC, m.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_search(text, int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_search(text, int) TO authenticated;

COMMENT ON FUNCTION public.rpc_chat_search IS
  'Busca global em mensagens do chat corporativo. SECURITY DEFINER filtra
   por participação ativa (conversas_participantes). headline já vem
   marcado com <<...>> nos termos pra UI destacar.';
