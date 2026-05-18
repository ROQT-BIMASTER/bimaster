-- =========================================================================
-- Fix: chat_directory vazio para não-admins por causa de NULL em filtros
-- =========================================================================
--
-- A view criada em 20260514100000_create_chat_directory_view.sql usa:
--   WHERE p.status = 'ativo' AND p.is_honeytoken = false
--
-- Em SQL, "NULL = false" e "NULL = 'ativo'" avaliam para NULL (falsy),
-- excluindo linhas em vez de tratá-las como verdadeiras. Profiles
-- antigos (anteriores ao backfill desses campos) podem ter NULL em
-- is_honeytoken e/ou status, e por isso somem da view — mesmo a
-- view sendo SECURITY DEFINER (security_invoker = off).
--
-- Resultado: usuários não-admin abriam a lista de colegas em /chat
-- e ela vinha vazia, mesmo após o PR #26 ter sido mergeado.
--
-- Esta migration recria a view com COALESCE em ambos os filtros:
--   - status NULL passa a contar como 'ativo' (incluído na lista)
--   - is_honeytoken NULL passa a contar como false (incluído)
--
-- Quem quiser ocultar um usuário do diretório precisa setar status
-- = 'inativo' OU is_honeytoken = true explicitamente.

DROP VIEW IF EXISTS public.chat_directory CASCADE;

CREATE VIEW public.chat_directory
WITH (security_invoker = off)
AS
SELECT
  p.id,
  p.nome,
  p.avatar_url
FROM public.profiles p
WHERE COALESCE(p.status, 'ativo') = 'ativo'
  AND COALESCE(p.is_honeytoken, false) = false;

REVOKE ALL ON public.chat_directory FROM anon, PUBLIC;
GRANT SELECT ON public.chat_directory TO authenticated;

COMMENT ON VIEW public.chat_directory IS
  'Diretório mínimo para o chat corporativo: id, nome, avatar_url de
  usuários ativos não-honeytoken. SECURITY DEFINER (security_invoker=off)
  para bypassar a RLS estrita de profiles. Filtros usam COALESCE para
  tratar profiles antigos com status/is_honeytoken NULL como
  ativo/não-honeytoken (inclusivos por default).';
