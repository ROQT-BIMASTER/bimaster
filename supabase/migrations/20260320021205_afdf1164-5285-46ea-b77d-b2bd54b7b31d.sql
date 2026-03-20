
-- ADV-4: Session invalidation queue for real-time permission revocation
CREATE TABLE IF NOT EXISTS public.session_invalidation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reason TEXT DEFAULT 'role_changed',
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.session_invalidation_queue ENABLE ROW LEVEL SECURITY;

-- Only service_role can INSERT (from triggers)
CREATE POLICY "service_role_insert" ON public.session_invalidation_queue
  FOR INSERT TO service_role WITH CHECK (true);

-- Authenticated users can only see their own invalidation records
CREATE POLICY "users_select_own" ON public.session_invalidation_queue
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Enable realtime for session_invalidation_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_invalidation_queue;

-- Trigger: when user_roles changes, insert into session_invalidation_queue
CREATE OR REPLACE FUNCTION public.notify_session_invalidation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.session_invalidation_queue (user_id, reason)
    VALUES (NEW.user_id, 'role_updated_from_' || OLD.role || '_to_' || NEW.role);
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.session_invalidation_queue (user_id, reason)
    VALUES (OLD.user_id, 'role_removed_' || OLD.role);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.session_invalidation_queue (user_id, reason)
    VALUES (NEW.user_id, 'role_added_' || NEW.role);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_session_invalidation_on_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_invalidation();

-- Cleanup: auto-delete records older than 24h (via periodic cleanup or on read)
CREATE OR REPLACE FUNCTION public.cleanup_session_invalidation_queue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.session_invalidation_queue
  WHERE invalidated_at < now() - interval '24 hours';
$$;

-- ADV-8: Seed default UI permission restrictions
-- These ensure vendedor/promotor roles have restricted access by default
INSERT INTO public.ui_permissions (role, departamento_id, tela_codigo, componente_codigo, visivel, editavel)
VALUES
  -- vendedor restrictions
  ('vendedor', NULL, 'financeiro_contas_pagar', 'aprovar_pagamento', false, false),
  ('vendedor', NULL, 'financeiro_contas_receber', 'baixar_recebimento', false, false),
  ('vendedor', NULL, 'relatorios', 'relatorio_financeiro_completo', false, false),
  ('vendedor', NULL, 'configuracoes', 'gestao_usuarios', false, false),
  -- promotor restrictions  
  ('promotor', NULL, 'financeiro_contas_pagar', 'aprovar_pagamento', false, false),
  ('promotor', NULL, 'financeiro_contas_receber', 'baixar_recebimento', false, false),
  ('promotor', NULL, 'china_ficha', 'campo_custos', false, false),
  ('promotor', NULL, 'relatorios', 'relatorio_financeiro_completo', false, false),
  ('promotor', NULL, 'configuracoes', 'gestao_usuarios', false, false),
  -- supervisor restrictions (cannot manage users)
  ('supervisor', NULL, 'configuracoes', 'gestao_usuarios', false, false),
  -- gerente gets full access explicitly
  ('gerente', NULL, 'financeiro_contas_pagar', 'aprovar_pagamento', true, true),
  ('gerente', NULL, 'financeiro_contas_receber', 'baixar_recebimento', true, true),
  -- admin gets full access explicitly
  ('admin', NULL, 'financeiro_contas_pagar', 'aprovar_pagamento', true, true),
  ('admin', NULL, 'financeiro_contas_receber', 'baixar_recebimento', true, true),
  ('admin', NULL, 'configuracoes', 'gestao_usuarios', true, true),
  ('admin', NULL, 'relatorios', 'relatorio_financeiro_completo', true, true),
  ('admin', NULL, 'china_ficha', 'campo_custos', true, true)
ON CONFLICT DO NOTHING;
