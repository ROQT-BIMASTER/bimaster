-- =========================================================================
-- Fix: conversas.tipo CHECK constraint não aceitava 'group'/'private'
-- =========================================================================
--
-- A tabela public.conversas foi criada em 2025-09-30 com:
--   CHECK (tipo IN ('privada', 'grupo'))   -- pt-BR
--
-- A RPC rpc_chat_criar_grupo (migration 20260513190406) tenta inserir
-- tipo='group' (en). A RPC rpc_chat_criar_conversa_privada (migration
-- 20260513210612) usa 'privada' (ok). O dialog de novo grupo, portanto,
-- falha com "violates check constraint conversas_tipo_check".
--
-- Em vez de alterar a RPC, expandimos o CHECK para aceitar ambos os
-- literais — é a opção menos invasiva, pois o front (useConversas.ts,
-- utils.ts) já trata 'group'|'grupo' como sinônimos no render, e mantém
-- compatibilidade com dados antigos.

ALTER TABLE public.conversas
  DROP CONSTRAINT IF EXISTS conversas_tipo_check;

ALTER TABLE public.conversas
  ADD CONSTRAINT conversas_tipo_check
  CHECK (tipo IN ('privada', 'grupo', 'private', 'group'));
