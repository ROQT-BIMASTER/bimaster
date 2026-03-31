
-- ============================================================
-- FASE 4: WARNINGS CLEANUP
-- ============================================================

-- 1. erp_portal_access_modules — SELECT por profile assignment para non-admin
CREATE POLICY "Users can view assigned modules" ON erp_portal_access_modules FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM erp_portal_user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.profile_id = erp_portal_access_modules.profile_id
    )
  );

-- 2. fabrica_formula_itens — corrigir DELETE sem módulo
DROP POLICY IF EXISTS "ffi_delete" ON fabrica_formula_itens;
CREATE POLICY "ffi_delete" ON fabrica_formula_itens FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));

-- 3. ai_training_examples — restringir SELECT a financeiro/admin
DROP POLICY IF EXISTS "Authenticated users can read training examples" ON ai_training_examples;
CREATE POLICY "ai_training_select_restricted" ON ai_training_examples FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_user_access(auth.uid(), 'financeiro')
  );

-- 4. cofre_share_tokens — adicionar filtro de expiração e revogação
DROP POLICY IF EXISTS "Users can view own share tokens" ON cofre_share_tokens;
CREATE POLICY "Users can view own active share tokens" ON cofre_share_tokens FOR SELECT TO authenticated
  USING (
    auth.uid() = created_by
    AND (is_revoked IS NOT TRUE)
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Users can update own share tokens" ON cofre_share_tokens;
CREATE POLICY "Users can update own share tokens" ON cofre_share_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
