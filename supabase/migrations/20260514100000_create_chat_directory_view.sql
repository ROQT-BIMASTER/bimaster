-- =========================================================================
-- Chat directory view (escopo: id, nome, avatar_url de usuários ativos)
-- =========================================================================
--
-- public.profiles tem RLS estrita (profiles_select_strict, em vigor desde
-- 2026-01-21): admin vê todos, supervisor vê só subordinados diretos,
-- demais usuários só veem o próprio. Faz sentido para proteger PII
-- (salário, supervisor_id, gerente_id, status, etc).
--
-- Mas o chat corporativo (/chat) precisa que QUALQUER usuário ativo veja
-- o nome e avatar dos colegas para iniciar conversas/grupos. Sem isso,
-- a lista de candidatos no NovaConversaDialog e GroupCreateDialog vem
-- vazia para qualquer um que não seja admin.
--
-- Solução: uma view SECURITY DEFINER (security_invoker = off) que expõe
-- APENAS id + nome + avatar_url de usuários ativos não-honeytoken.
-- Email, departamento, supervisor, salário etc continuam protegidos
-- pela RLS de profiles.

CREATE OR REPLACE VIEW public.chat_directory
WITH (security_invoker = off)
AS
SELECT
  p.id,
  p.nome,
  p.avatar_url
FROM public.profiles p
WHERE p.status = 'ativo'
  AND p.is_honeytoken = false;

REVOKE ALL ON public.chat_directory FROM anon, PUBLIC;
GRANT SELECT ON public.chat_directory TO authenticated;

COMMENT ON VIEW public.chat_directory IS
  'Diretório mínimo para o chat corporativo: id, nome, avatar_url de
  usuários ativos não-honeytoken. SECURITY DEFINER (security_invoker=off)
  para bypassar a RLS estrita de profiles. Não inclui email/PII — quem
  precisa de mais campos deve consultar profiles diretamente e respeitar
  a RLS hierárquica.';
