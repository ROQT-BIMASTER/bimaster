
-- 1. fabrica_notas_fiscais_saida
DROP POLICY IF EXISTS "fabrica_notas_fiscais_saida_insert" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "fabrica_notas_fiscais_saida_update" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "fabrica_notas_fiscais_saida_delete" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "Authenticated users can insert fabrica_notas_fiscais_saida" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "Authenticated users can update fabrica_notas_fiscais_saida" ON public.fabrica_notas_fiscais_saida;
DROP POLICY IF EXISTS "Authenticated users can delete fabrica_notas_fiscais_saida" ON public.fabrica_notas_fiscais_saida;

CREATE POLICY "fabrica_nfs_saida_insert_restricted" ON public.fabrica_notas_fiscais_saida
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_nfs_saida_update_restricted" ON public.fabrica_notas_fiscais_saida
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_nfs_saida_delete_restricted" ON public.fabrica_notas_fiscais_saida
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

-- 2. fabrica_itens_nf_saida
DROP POLICY IF EXISTS "fabrica_itens_nf_saida_insert" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "fabrica_itens_nf_saida_update" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "fabrica_itens_nf_saida_delete" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "Authenticated users can insert fabrica_itens_nf_saida" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "Authenticated users can update fabrica_itens_nf_saida" ON public.fabrica_itens_nf_saida;
DROP POLICY IF EXISTS "Authenticated users can delete fabrica_itens_nf_saida" ON public.fabrica_itens_nf_saida;

CREATE POLICY "fabrica_itens_nfs_insert_restricted" ON public.fabrica_itens_nf_saida
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_itens_nfs_update_restricted" ON public.fabrica_itens_nf_saida
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_itens_nfs_delete_restricted" ON public.fabrica_itens_nf_saida
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

-- 3. fabrica_tax_rates_iva
DROP POLICY IF EXISTS "fabrica_tax_rates_iva_insert" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "fabrica_tax_rates_iva_update" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "fabrica_tax_rates_iva_delete" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "Authenticated users can insert fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "Authenticated users can update fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;
DROP POLICY IF EXISTS "Authenticated users can delete fabrica_tax_rates_iva" ON public.fabrica_tax_rates_iva;

CREATE POLICY "fabrica_tax_iva_insert_restricted" ON public.fabrica_tax_rates_iva
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_tax_iva_update_restricted" ON public.fabrica_tax_rates_iva
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "fabrica_tax_iva_delete_restricted" ON public.fabrica_tax_rates_iva
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

-- 4. process_despacho_documento
DROP POLICY IF EXISTS "Authenticated users can manage despachos" ON public.process_despacho_documento;
DROP POLICY IF EXISTS "process_despacho_documento_select" ON public.process_despacho_documento;
DROP POLICY IF EXISTS "process_despacho_documento_insert" ON public.process_despacho_documento;
DROP POLICY IF EXISTS "process_despacho_documento_update" ON public.process_despacho_documento;
DROP POLICY IF EXISTS "process_despacho_documento_delete" ON public.process_despacho_documento;

CREATE POLICY "despacho_doc_select" ON public.process_despacho_documento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "despacho_doc_insert" ON public.process_despacho_documento
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR created_by = auth.uid());

CREATE POLICY "despacho_doc_update" ON public.process_despacho_documento
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR created_by = auth.uid());

CREATE POLICY "despacho_doc_delete" ON public.process_despacho_documento
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- 5. product_process
DROP POLICY IF EXISTS "Authenticated users can manage product_process" ON public.product_process;
DROP POLICY IF EXISTS "product_process_select" ON public.product_process;
DROP POLICY IF EXISTS "product_process_insert" ON public.product_process;
DROP POLICY IF EXISTS "product_process_update" ON public.product_process;
DROP POLICY IF EXISTS "product_process_delete" ON public.product_process;

CREATE POLICY "product_process_select" ON public.product_process
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "product_process_insert_restricted" ON public.product_process
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "product_process_update_restricted" ON public.product_process
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "product_process_delete_restricted" ON public.product_process
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- 6. china_categoria_responsaveis
DROP POLICY IF EXISTS "china_categoria_responsaveis_insert" ON public.china_categoria_responsaveis;
DROP POLICY IF EXISTS "china_categoria_responsaveis_update" ON public.china_categoria_responsaveis;
DROP POLICY IF EXISTS "china_categoria_responsaveis_delete" ON public.china_categoria_responsaveis;
DROP POLICY IF EXISTS "Authenticated users can insert china_categoria_responsaveis" ON public.china_categoria_responsaveis;
DROP POLICY IF EXISTS "Authenticated users can update china_categoria_responsaveis" ON public.china_categoria_responsaveis;
DROP POLICY IF EXISTS "Authenticated users can delete china_categoria_responsaveis" ON public.china_categoria_responsaveis;

CREATE POLICY "china_cat_resp_insert_restricted" ON public.china_categoria_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "china_cat_resp_update_restricted" ON public.china_categoria_responsaveis
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'fábrica'));

CREATE POLICY "china_cat_resp_delete_restricted" ON public.china_categoria_responsaveis
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- 7. fluxo_aprovacao_instancias
DROP POLICY IF EXISTS "fluxo_aprovacao_instancias_insert" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fluxo_aprovacao_instancias_update" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "Authenticated users can update fluxo_aprovacao_instancias" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fluxo_instancias_insert" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fluxo_instancias_update" ON public.fluxo_aprovacao_instancias;

CREATE POLICY "fluxo_inst_insert_restricted" ON public.fluxo_aprovacao_instancias
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR created_by = auth.uid());

CREATE POLICY "fluxo_inst_update_restricted" ON public.fluxo_aprovacao_instancias
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR created_by = auth.uid());
