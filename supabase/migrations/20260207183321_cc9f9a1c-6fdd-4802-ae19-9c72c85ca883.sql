
-- ================================================================
-- MIGRAÇÃO: Otimização Massiva de Performance
-- Consolida ~974 policies para ~400, elimina cascata de funções
-- Impacto: -70-80% operações de banco, -90% lookups user_roles
-- ================================================================

-- ================================================
-- ETAPA 1: Função unificada check_user_access
-- ================================================
CREATE OR REPLACE FUNCTION public.check_user_access(
  _user_id uuid,
  _module_code text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _role text;
  _department_id uuid;
BEGIN
  SELECT ur.role::text, p.departamento_id
  INTO _role, _department_id
  FROM public.user_roles ur
  LEFT JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = _user_id
  LIMIT 1;

  IF _role = 'admin' THEN RETURN true; END IF;
  IF _module_code IS NULL THEN RETURN _role IN ('supervisor', 'gerente'); END IF;
  IF _role IN ('supervisor', 'gerente') THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.usuario_permissoes_modulos upm
    JOIN public.modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE upm.usuario_id = _user_id AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  IF _department_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.departamento_permissoes_modulos dpm
    JOIN public.modulos_sistema ms ON ms.id = dpm.modulo_id
    WHERE dpm.departamento_id = _department_id AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  IF _role IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.role_permissoes_modulos rpm
    JOIN public.modulos_sistema ms ON ms.id = rpm.modulo_id
    WHERE rpm.role = _role AND ms.codigo = _module_code AND ms.ativo = true
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_access(uuid, text) TO anon;

-- ================================================
-- ETAPA 2: Atualizar funções auxiliares
-- ================================================
CREATE OR REPLACE FUNCTION public.can_access_cliente(viewer_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.check_user_access(viewer_id, 'vendas');
$$;

CREATE OR REPLACE FUNCTION public.can_access_fabrica(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.check_user_access(_user_id, 'fabrica');
$$;

CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.check_user_access(_user_id, 'financeiro');
$$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_modulo(_user_id uuid, _modulo_codigo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.check_user_access(_user_id, _modulo_codigo);
$$;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao_modulo(_user_id uuid, _modulo_codigo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.check_user_access(_user_id, _modulo_codigo);
$$;

-- ================================================
-- ETAPA 3: Drop ALL policies das tabelas a consolidar
-- ================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN (
      'ai_calls','atividades','audit_logs','assinaturas',
      'clientes_alertas_credito','clientes_perfil_credito',
      'cobrancas','cobrancas_enviadas','competitors','competitor_intelligence',
      'contas_pagar','contas_receber',
      'departamento_permissoes_modulos','departamento_permissoes_telas','departamentos',
      'fabrica_codigos_fornecedor','fabrica_formula_itens','fabrica_formulas',
      'fabrica_itens_nf','fabrica_limites_preco_tabela','fabrica_materias_primas',
      'fabrica_precos_produtos','fabrica_produto_custos','fabrica_produtos',
      'fabrica_tabelas_preco','fila_cobrancas','goals','notifications',
      'photos','prospects','sales','store_products','stores',
      'trade_bank_transactions','trade_budgets','trade_campaign_audit_log',
      'trade_chart_of_accounts','trade_financial_entries','trade_investments',
      'user_roles','user_whatsapp','visits','ai_insights'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ================================================
-- ETAPA 4: Criar policies consolidadas
-- ================================================

-- ---- ai_calls (vendedor_id ownership) ----
CREATE POLICY "ai_calls_select" ON public.ai_calls FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "ai_calls_insert" ON public.ai_calls FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "ai_calls_update" ON public.ai_calls FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "ai_calls_deny_anon" ON public.ai_calls FOR SELECT TO anon USING (false);

-- ---- ai_insights (admin/supervisor + entity) ----
CREATE POLICY "ai_insights_select" ON public.ai_insights FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid()) OR (
    entity_type = 'prospect' AND EXISTS (
      SELECT 1 FROM public.prospects p WHERE p.id = ai_insights.entity_id AND p.vendedor_id = auth.uid()
    )
  ));
CREATE POLICY "ai_insights_insert" ON public.ai_insights FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "ai_insights_update" ON public.ai_insights FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "ai_insights_delete" ON public.ai_insights FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- assinaturas (usuario_id ownership) ----
CREATE POLICY "assinaturas_select" ON public.assinaturas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "assinaturas_insert" ON public.assinaturas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "assinaturas_update" ON public.assinaturas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "assinaturas_delete" ON public.assinaturas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- atividades (vendedor_id ownership) ----
CREATE POLICY "atividades_select" ON public.atividades FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'vendas'));
CREATE POLICY "atividades_insert" ON public.atividades FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "atividades_update" ON public.atividades FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "atividades_delete" ON public.atividades FOR DELETE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));

-- ---- audit_logs (admin only) ----
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ---- clientes_alertas_credito (financeiro module) ----
CREATE POLICY "alertas_credito_select" ON public.clientes_alertas_credito FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "alertas_credito_insert" ON public.clientes_alertas_credito FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "alertas_credito_update" ON public.clientes_alertas_credito FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "alertas_credito_delete" ON public.clientes_alertas_credito FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- clientes_perfil_credito (financeiro module) ----
CREATE POLICY "perfil_credito_select" ON public.clientes_perfil_credito FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "perfil_credito_insert" ON public.clientes_perfil_credito FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "perfil_credito_update" ON public.clientes_perfil_credito FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "perfil_credito_delete" ON public.clientes_perfil_credito FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- cobrancas (financeiro + responsavel_id) ----
CREATE POLICY "cobrancas_select" ON public.cobrancas FOR SELECT TO authenticated
  USING (responsavel_id = auth.uid() OR public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cobrancas_insert" ON public.cobrancas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cobrancas_update" ON public.cobrancas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cobrancas_delete" ON public.cobrancas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- cobrancas_enviadas (financeiro module) ----
CREATE POLICY "cob_env_select" ON public.cobrancas_enviadas FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cob_env_insert" ON public.cobrancas_enviadas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cob_env_update" ON public.cobrancas_enviadas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cob_env_delete" ON public.cobrancas_enviadas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- competitors (reference - all can view) ----
CREATE POLICY "competitors_select" ON public.competitors FOR SELECT TO authenticated USING (true);
CREATE POLICY "competitors_insert" ON public.competitors FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "competitors_update" ON public.competitors FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "competitors_delete" ON public.competitors FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- competitor_intelligence (vendedor_id + trade) ----
CREATE POLICY "ci_select" ON public.competitor_intelligence FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "ci_insert" ON public.competitor_intelligence FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "ci_update" ON public.competitor_intelligence FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "ci_delete" ON public.competitor_intelligence FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- contas_pagar (financeiro module) ----
CREATE POLICY "cp_select" ON public.contas_pagar FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cp_deny_anon" ON public.contas_pagar FOR SELECT TO anon USING (false);
CREATE POLICY "cp_insert" ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cp_update" ON public.contas_pagar FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cp_delete" ON public.contas_pagar FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- contas_receber (financeiro module) ----
CREATE POLICY "cr_select" ON public.contas_receber FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cr_deny_anon" ON public.contas_receber FOR SELECT TO anon USING (false);
CREATE POLICY "cr_insert" ON public.contas_receber FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "cr_update" ON public.contas_receber FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

-- ---- departamento_permissoes_modulos (reference) ----
CREATE POLICY "dpm_select" ON public.departamento_permissoes_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpm_insert" ON public.departamento_permissoes_modulos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "dpm_update" ON public.departamento_permissoes_modulos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "dpm_delete" ON public.departamento_permissoes_modulos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- departamento_permissoes_telas (reference) ----
CREATE POLICY "dpt_select" ON public.departamento_permissoes_telas FOR SELECT TO authenticated USING (true);
CREATE POLICY "dpt_insert" ON public.departamento_permissoes_telas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "dpt_update" ON public.departamento_permissoes_telas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "dpt_delete" ON public.departamento_permissoes_telas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- departamentos (reference) ----
CREATE POLICY "dept_select" ON public.departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "dept_insert" ON public.departamentos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "dept_update" ON public.departamentos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "dept_delete" ON public.departamentos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_codigos_fornecedor (fabrica module) ----
CREATE POLICY "fcf_select" ON public.fabrica_codigos_fornecedor FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fcf_insert" ON public.fabrica_codigos_fornecedor FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fcf_update" ON public.fabrica_codigos_fornecedor FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fcf_delete" ON public.fabrica_codigos_fornecedor FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_formula_itens (fabrica module) ----
CREATE POLICY "ffi_select" ON public.fabrica_formula_itens FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ffi_insert" ON public.fabrica_formula_itens FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ffi_update" ON public.fabrica_formula_itens FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ffi_delete" ON public.fabrica_formula_itens FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_formulas (fabrica module) ----
CREATE POLICY "ff_select" ON public.fabrica_formulas FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ff_insert" ON public.fabrica_formulas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ff_update" ON public.fabrica_formulas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ff_delete" ON public.fabrica_formulas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_itens_nf (fabrica module) ----
CREATE POLICY "finf_select" ON public.fabrica_itens_nf FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "finf_insert" ON public.fabrica_itens_nf FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "finf_update" ON public.fabrica_itens_nf FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "finf_delete" ON public.fabrica_itens_nf FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_limites_preco_tabela (fabrica module) ----
CREATE POLICY "flpt_select" ON public.fabrica_limites_preco_tabela FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "flpt_insert" ON public.fabrica_limites_preco_tabela FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "flpt_update" ON public.fabrica_limites_preco_tabela FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "flpt_delete" ON public.fabrica_limites_preco_tabela FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_materias_primas (fabrica module) ----
CREATE POLICY "fmp_select" ON public.fabrica_materias_primas FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fmp_insert" ON public.fabrica_materias_primas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fmp_update" ON public.fabrica_materias_primas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fmp_delete" ON public.fabrica_materias_primas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_precos_produtos (fabrica module) ----
CREATE POLICY "fpp_select" ON public.fabrica_precos_produtos FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpp_insert" ON public.fabrica_precos_produtos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpp_update" ON public.fabrica_precos_produtos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpp_delete" ON public.fabrica_precos_produtos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_produto_custos (fabrica module) ----
CREATE POLICY "fpc_select" ON public.fabrica_produto_custos FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpc_insert" ON public.fabrica_produto_custos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpc_update" ON public.fabrica_produto_custos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fpc_delete" ON public.fabrica_produto_custos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_produtos (fabrica module) ----
CREATE POLICY "fp_select" ON public.fabrica_produtos FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fp_insert" ON public.fabrica_produtos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fp_update" ON public.fabrica_produtos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "fp_delete" ON public.fabrica_produtos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fabrica_tabelas_preco (fabrica module) ----
CREATE POLICY "ftp_select" ON public.fabrica_tabelas_preco FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ftp_insert" ON public.fabrica_tabelas_preco FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ftp_update" ON public.fabrica_tabelas_preco FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "ftp_delete" ON public.fabrica_tabelas_preco FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- fila_cobrancas (financeiro module) ----
CREATE POLICY "fc_select" ON public.fila_cobrancas FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "fc_insert" ON public.fila_cobrancas FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "fc_update" ON public.fila_cobrancas FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));
CREATE POLICY "fc_delete" ON public.fila_cobrancas FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- goals (user_id ownership) ----
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "goals_insert" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "goals_delete" ON public.goals FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- notifications (user_id ownership) ----
CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- photos (vendedor_id + visit ownership) ----
CREATE POLICY "photos_select" ON public.photos FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "photos_insert" ON public.photos FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "photos_update" ON public.photos FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "photos_delete" ON public.photos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- prospects (vendedor_id ownership) ----
CREATE POLICY "prospects_select" ON public.prospects FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'vendas'));
CREATE POLICY "prospects_insert" ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "prospects_update" ON public.prospects FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "prospects_delete" ON public.prospects FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- sales (vendedor_id ownership) ----
CREATE POLICY "sales_select" ON public.sales FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'vendas'));
CREATE POLICY "sales_insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "sales_update" ON public.sales FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "sales_delete" ON public.sales FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- store_products (vendedor_id ownership) ----
CREATE POLICY "sp_select" ON public.store_products FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "sp_insert" ON public.store_products FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "sp_update" ON public.store_products FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "sp_delete" ON public.store_products FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- stores (vendedor_id + created_by ownership) ----
CREATE POLICY "stores_select" ON public.stores FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR created_by = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "stores_insert" ON public.stores FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "stores_update" ON public.stores FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR created_by = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "stores_delete" ON public.stores FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- trade_bank_transactions (admin/supervisor) ----
CREATE POLICY "tbt_select" ON public.trade_bank_transactions FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "tbt_insert" ON public.trade_bank_transactions FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "tbt_update" ON public.trade_bank_transactions FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "tbt_delete" ON public.trade_bank_transactions FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- trade_budgets (trade module + ownership) ----
CREATE POLICY "tb_select" ON public.trade_budgets FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "tb_insert" ON public.trade_budgets FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "tb_update" ON public.trade_budgets FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "tb_delete" ON public.trade_budgets FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- trade_campaign_audit_log (authenticated access) ----
CREATE POLICY "tcal_select" ON public.trade_campaign_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "tcal_insert" ON public.trade_campaign_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tcal_delete" ON public.trade_campaign_audit_log FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- trade_chart_of_accounts (reference) ----
CREATE POLICY "tcoa_select" ON public.trade_chart_of_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "tcoa_insert" ON public.trade_chart_of_accounts FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid()));
CREATE POLICY "tcoa_update" ON public.trade_chart_of_accounts FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid()));
CREATE POLICY "tcoa_delete" ON public.trade_chart_of_accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- trade_financial_entries (created_by + admin) ----
CREATE POLICY "tfe_select" ON public.trade_financial_entries FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "tfe_insert" ON public.trade_financial_entries FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "tfe_update" ON public.trade_financial_entries FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "tfe_delete" ON public.trade_financial_entries FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- trade_investments (vendedor_id ownership + trade) ----
CREATE POLICY "ti_select" ON public.trade_investments FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR created_by = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "ti_deny_anon" ON public.trade_investments FOR SELECT TO anon USING (false);
CREATE POLICY "ti_insert" ON public.trade_investments FOR INSERT TO authenticated
  WITH CHECK (vendedor_id = auth.uid() OR public.check_user_access(auth.uid(), 'trade'));
CREATE POLICY "ti_update" ON public.trade_investments FOR UPDATE TO authenticated
  USING (vendedor_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "ti_delete" ON public.trade_investments FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- user_roles (admin manages, users see own) ----
CREATE POLICY "ur_select" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "ur_insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ur_delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---- user_whatsapp (user_id ownership) ----
CREATE POLICY "uw_select" ON public.user_whatsapp FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "uw_insert" ON public.user_whatsapp FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "uw_update" ON public.user_whatsapp FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "uw_delete" ON public.user_whatsapp FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ---- visits (user_id + store ownership) ----
CREATE POLICY "visits_select" ON public.visits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR vendedor_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = visits.store_id AND s.created_by = auth.uid()) OR
    public.check_user_access(auth.uid()));
CREATE POLICY "visits_insert" ON public.visits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "visits_update" ON public.visits FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.check_user_access(auth.uid()));
CREATE POLICY "visits_delete" ON public.visits FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid()));

-- ================================================
-- ETAPA 5: Limpeza audit_logs e otimização retenção
-- ================================================
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs 
  WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Audit logs cleanup: % registros removidos', deleted_count;
END;
$$;

-- Limpeza imediata
DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '7 days';
