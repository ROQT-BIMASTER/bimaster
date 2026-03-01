
-- =====================================================
-- SECURITY HARDENING MIGRATION
-- =====================================================

-- 1. SAFE VIEW FOR fabrica_fornecedores (hide banking info from non-finance)
CREATE OR REPLACE VIEW public.fabrica_fornecedores_safe
WITH (security_invoker = on) AS
SELECT 
  id, razao_social, nome_fantasia, cnpj, contato,
  telefone, email, endereco, ativo, created_at, updated_at,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN banco ELSE NULL END AS banco,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN agencia ELSE NULL END AS agencia,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN conta ELSE NULL END AS conta,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN tipo_conta ELSE NULL END AS tipo_conta,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN pix_chave ELSE NULL END AS pix_chave,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN pix_tipo ELSE NULL END AS pix_tipo,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN favorecido ELSE NULL END AS favorecido,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN linha_digitavel ELSE NULL END AS linha_digitavel
FROM public.fabrica_fornecedores;

-- 2. SAFE VIEW FOR stores (hide banking info)
CREATE OR REPLACE VIEW public.stores_safe
WITH (security_invoker = on) AS
SELECT 
  id, code, name, chain, cnpj, address, city, state, zip_code,
  latitude, longitude, phone, email, category, size, monthly_revenue,
  visit_frequency, priority, status, manager_name, manager_phone, notes,
  created_by, created_at, updated_at, vendedor_id, supervisor_id,
  branch_count, classification, situacao_cadastral, porte_empresa,
  regime_tributario, matriz_filial, capital_social, cnae_principal,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN banco ELSE NULL END AS banco,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN agencia ELSE NULL END AS agencia,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN conta ELSE NULL END AS conta,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN tipo_conta ELSE NULL END AS tipo_conta,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN pix_chave ELSE NULL END AS pix_chave,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN pix_tipo ELSE NULL END AS pix_tipo,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN favorecido ELSE NULL END AS favorecido,
  CASE WHEN has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')
    THEN linha_digitavel ELSE NULL END AS linha_digitavel
FROM public.stores;

-- 3. HARDEN user_whatsapp - restrict to own records + hierarchy
DROP POLICY IF EXISTS "uw_select" ON public.user_whatsapp;
CREATE POLICY "uw_select_hardened" ON public.user_whatsapp
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR (has_role(auth.uid(), 'supervisor') AND is_supervisor_of(auth.uid(), user_id))
);

DROP POLICY IF EXISTS "uw_update" ON public.user_whatsapp;
CREATE POLICY "uw_update_hardened" ON public.user_whatsapp
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "uw_insert" ON public.user_whatsapp;
CREATE POLICY "uw_insert_hardened" ON public.user_whatsapp
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "uw_delete" ON public.user_whatsapp;
CREATE POLICY "uw_delete_hardened" ON public.user_whatsapp
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 4. HARDEN contas_pagar DELETE - admin only
DROP POLICY IF EXISTS "cp_delete" ON public.contas_pagar;
CREATE POLICY "cp_delete_hardened" ON public.contas_pagar
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 5. HARDEN team_form_submissions - remove hardcoded UUIDs
DROP POLICY IF EXISTS "authorized_view_submissions" ON public.team_form_submissions;
CREATE POLICY "authorized_view_submissions_v2" ON public.team_form_submissions
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR EXISTS (
    SELECT 1 FROM team_form_tokens t
    WHERE t.id = team_form_submissions.token_id
    AND t.created_by = auth.uid()
  )
);

-- 6. HARDEN prospects - hierarchy-based access
DROP POLICY IF EXISTS "prospects_select" ON public.prospects;
CREATE POLICY "prospects_select_hardened" ON public.prospects
FOR SELECT TO authenticated
USING (
  vendedor_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR (has_role(auth.uid(), 'supervisor') AND is_supervisor_of(auth.uid(), vendedor_id))
  OR usuario_tem_acesso_prospect(auth.uid(), id)
);

DROP POLICY IF EXISTS "prospects_update" ON public.prospects;
CREATE POLICY "prospects_update_hardened" ON public.prospects
FOR UPDATE TO authenticated
USING (
  vendedor_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR (has_role(auth.uid(), 'supervisor') AND is_supervisor_of(auth.uid(), vendedor_id))
)
WITH CHECK (
  vendedor_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR (has_role(auth.uid(), 'supervisor') AND is_supervisor_of(auth.uid(), vendedor_id))
);

DROP POLICY IF EXISTS "prospects_delete" ON public.prospects;
CREATE POLICY "prospects_delete_hardened" ON public.prospects
FOR DELETE TO authenticated
USING (
  vendedor_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
);

-- 7. HARDEN ai_call_actions - use authenticated role
DROP POLICY IF EXISTS "Supervisores podem gerenciar ações de chamadas" ON public.ai_call_actions;
CREATE POLICY "ai_call_actions_admin_supervisor" ON public.ai_call_actions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Vendedores podem ver ações de suas chamadas" ON public.ai_call_actions;
CREATE POLICY "ai_call_actions_owner" ON public.ai_call_actions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM ai_calls
    WHERE ai_calls.id = ai_call_actions.call_id
    AND ai_calls.vendedor_id = auth.uid()
  )
);

-- 8. HARDEN ai_call_transcriptions
DROP POLICY IF EXISTS "Supervisores podem gerenciar transcrições" ON public.ai_call_transcriptions;
CREATE POLICY "ai_call_transcriptions_admin_supervisor" ON public.ai_call_transcriptions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Vendedores podem ver transcrições de suas chamadas" ON public.ai_call_transcriptions;
CREATE POLICY "ai_call_transcriptions_owner" ON public.ai_call_transcriptions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM ai_calls
    WHERE ai_calls.id = ai_call_transcriptions.call_id
    AND ai_calls.vendedor_id = auth.uid()
  )
);

-- 9. HARDEN clientes - module-restricted access
DROP POLICY IF EXISTS "clientes_select_authorized" ON public.clientes;
CREATE POLICY "clientes_select_module" ON public.clientes
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'gerente')
  OR check_user_access(auth.uid(), 'comercial')
  OR check_user_access(auth.uid(), 'vendas')
  OR check_user_access(auth.uid(), 'financeiro')
);

-- 10. HARDEN stores_insert - require module access
DROP POLICY IF EXISTS "stores_insert" ON public.stores;
CREATE POLICY "stores_insert_hardened" ON public.stores
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'supervisor')
  OR check_user_access(auth.uid(), 'trade_marketing')
  OR check_user_access(auth.uid(), 'comercial')
);
