-- Lote 5: Revoke EXECUTE on internal RLS predicate helpers from authenticated/anon/public
-- These functions are called only from within other policies/SECDEF functions
-- (which run as owner), so revoking direct EXECUTE has no functional impact.

REVOKE EXECUTE ON FUNCTION public.can_access_bank_accounts(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_fabrica(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_meeting(_user_id uuid, _meeting_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_notas_fiscais(viewer_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_access_payment_queue(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_event(_user_id uuid, _event_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.check_user_access(_user_id uuid, _module_code text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.check_user_access_tela(_user_id uuid, _tela_code text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_event_access(_user_id uuid, _permission text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_finance_access(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_financial_role(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_marketing_social_access(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role_or_higher(_user_id uuid, _min_role app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_trade_admin_permission(check_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_account_quarantined(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_supervisor(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_participant_of_conversa(conversa_id_param uuid, user_id_param uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_sales_team(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_supervisor_of(_supervisor_id uuid, _user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.mfa_is_enforced_for_user(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_plano(p_user_id uuid, p_plano_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_projeto(_user_id uuid, _projeto_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_projeto_via_tarefa(_user_id uuid, _tarefa_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_secao(_user_id uuid, _secao_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_active_mfa(_uid uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_empresa_access(_user_id uuid, _empresa_id integer) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.user_requires_mfa(_uid uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_acesso_estoque(_user_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_acesso_loja(_user_id uuid, _store_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_acesso_modulo(_user_id uuid, _modulo_codigo text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_acesso_prospect(_user_id uuid, _prospect_id uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_permissao_modulo(_user_id uuid, _modulo_codigo text) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.usuario_tem_permissao_tela(_user_id uuid, _tela_codigo text) FROM authenticated, anon, public;