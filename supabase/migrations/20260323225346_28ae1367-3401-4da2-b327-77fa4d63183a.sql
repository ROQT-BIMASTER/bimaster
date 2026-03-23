
-- 1. Clear all existing plaintext tokens (security hardening)
UPDATE public.team_form_tokens SET token_plain = NULL WHERE token_plain IS NOT NULL;

-- 2. Create audit trigger for API key deletions
CREATE OR REPLACE FUNCTION public.audit_erp_api_key_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    action, entity_type, entity_id, user_id,
    old_data, metadata
  ) VALUES (
    'delete',
    'erp_api_key',
    OLD.id,
    auth.uid(),
    jsonb_build_object(
      'empresa_id', OLD.empresa_id,
      'nome_responsavel', OLD.nome_responsavel,
      'key_preview', OLD.key_preview,
      'active', OLD.active,
      'expires_at', OLD.expires_at
    ),
    jsonb_build_object('source', 'portal_erp')
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_erp_api_key_delete
  BEFORE DELETE ON public.erp_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_erp_api_key_delete();
