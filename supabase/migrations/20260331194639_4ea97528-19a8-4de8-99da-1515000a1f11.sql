
-- ============================================================
-- FASE 1: RLS HARDENING — 8 TABELAS
-- ============================================================

-- 1. audit_logs_archive — restringir a admin only
DROP POLICY IF EXISTS "Approved users can view audit archive" ON audit_logs_archive;
CREATE POLICY "Only admins can view audit archive"
  ON audit_logs_archive FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. china_pasta_digital — restringir por módulo fabrica_china
DROP POLICY IF EXISTS "Authenticated users can view china_pasta_digital" ON china_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can insert china_pasta_digital" ON china_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can update china_pasta_digital" ON china_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can delete china_pasta_digital" ON china_pasta_digital;

CREATE POLICY "china_pasta_select" ON china_pasta_digital FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china') OR created_by = auth.uid());
CREATE POLICY "china_pasta_insert" ON china_pasta_digital FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica_china'));
CREATE POLICY "china_pasta_update" ON china_pasta_digital FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china') OR created_by = auth.uid())
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica_china') OR created_by = auth.uid());
CREATE POLICY "china_pasta_delete" ON china_pasta_digital FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china') OR created_by = auth.uid());

-- 3. vendedor_territorios — restringir escrita a admin/supervisor
DROP POLICY IF EXISTS "Admins and managers can insert territories" ON vendedor_territorios;
DROP POLICY IF EXISTS "Admins and managers can update territories" ON vendedor_territorios;
DROP POLICY IF EXISTS "Admins and managers can delete territories" ON vendedor_territorios;

CREATE POLICY "Admin/supervisor can insert territories" ON vendedor_territorios FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admin/supervisor can update territories" ON vendedor_territorios FOR UPDATE TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));
CREATE POLICY "Admin/supervisor can delete territories" ON vendedor_territorios FOR DELETE TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()));

-- 4. produto_peticionamento — restringir por módulo fabrica
DROP POLICY IF EXISTS "Authenticated users can manage peticionamento" ON produto_peticionamento;

CREATE POLICY "pp_select" ON produto_peticionamento FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pp_insert" ON produto_peticionamento FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pp_update" ON produto_peticionamento FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'))
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pp_delete" ON produto_peticionamento FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));

-- 5. china_submissao_tarefa_vinculos — restringir por módulo fabrica_china
DROP POLICY IF EXISTS "Authenticated users can manage vinculos" ON china_submissao_tarefa_vinculos;

CREATE POLICY "cstv_select" ON china_submissao_tarefa_vinculos FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china'));
CREATE POLICY "cstv_insert" ON china_submissao_tarefa_vinculos FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica_china'));
CREATE POLICY "cstv_update" ON china_submissao_tarefa_vinculos FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china'))
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica_china'));
CREATE POLICY "cstv_delete" ON china_submissao_tarefa_vinculos FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica_china'));

-- 6. produto_composicao — restringir por módulo fabrica
DROP POLICY IF EXISTS "Authenticated users can manage composicao" ON produto_composicao;

CREATE POLICY "pc_select" ON produto_composicao FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pc_insert" ON produto_composicao FOR INSERT TO authenticated
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pc_update" ON produto_composicao FOR UPDATE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'))
  WITH CHECK (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pc_delete" ON produto_composicao FOR DELETE TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));

-- 7. produto_gate_criacao — restringir a admin/supervisor
DROP POLICY IF EXISTS "Authenticated users can manage gate_criacao" ON produto_gate_criacao;

CREATE POLICY "pgc_select" ON produto_gate_criacao FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'fabrica'));
CREATE POLICY "pgc_insert" ON produto_gate_criacao FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));
CREATE POLICY "pgc_update" ON produto_gate_criacao FOR UPDATE TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));
CREATE POLICY "pgc_delete" ON produto_gate_criacao FOR DELETE TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()));

-- 8. processo_documento_recebimentos — restringir SELECT por ownership
DROP POLICY IF EXISTS "Authenticated users can select recebimentos" ON processo_documento_recebimentos;

CREATE POLICY "pdr_select" ON processo_documento_recebimentos FOR SELECT TO authenticated
  USING (confirmado_por = auth.uid() OR public.is_admin_or_supervisor(auth.uid()));
