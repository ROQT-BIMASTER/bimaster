
-- 1. erp_sync_log: remover política permissiva genérica e INSERT duplicado
DROP POLICY IF EXISTS "erp_sync_log_auth_access" ON public.erp_sync_log;
DROP POLICY IF EXISTS "erp_sync_log_insert_authenticated" ON public.erp_sync_log;
DROP POLICY IF EXISTS "Authenticated users can insert erp_sync_log" ON public.erp_sync_log;

-- 2. metas_vendas: restringir SELECT
DROP POLICY IF EXISTS "Authenticated read metas_vendas" ON public.metas_vendas;
CREATE POLICY "metas_vendas_select_restricted" ON public.metas_vendas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

-- 3. oms_pedidos: restringir SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "oms_pedidos_select" ON public.oms_pedidos;
DROP POLICY IF EXISTS "oms_pedidos_insert" ON public.oms_pedidos;
DROP POLICY IF EXISTS "oms_pedidos_update" ON public.oms_pedidos;

CREATE POLICY "oms_pedidos_select_restricted" ON public.oms_pedidos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

CREATE POLICY "oms_pedidos_insert_restricted" ON public.oms_pedidos
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

CREATE POLICY "oms_pedidos_update_restricted" ON public.oms_pedidos
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

-- 4. oms_pedido_itens: restringir SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "oms_pedido_itens_select" ON public.oms_pedido_itens;
DROP POLICY IF EXISTS "oms_pedido_itens_insert" ON public.oms_pedido_itens;
DROP POLICY IF EXISTS "oms_pedido_itens_update" ON public.oms_pedido_itens;

CREATE POLICY "oms_pedido_itens_select_restricted" ON public.oms_pedido_itens
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

CREATE POLICY "oms_pedido_itens_insert_restricted" ON public.oms_pedido_itens
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

CREATE POLICY "oms_pedido_itens_update_restricted" ON public.oms_pedido_itens
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

-- 5. oms_pedido_status_log: restringir SELECT, INSERT
DROP POLICY IF EXISTS "oms_status_log_select" ON public.oms_pedido_status_log;
DROP POLICY IF EXISTS "oms_status_log_insert" ON public.oms_pedido_status_log;

CREATE POLICY "oms_status_log_select_restricted" ON public.oms_pedido_status_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );

CREATE POLICY "oms_status_log_insert_restricted" ON public.oms_pedido_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'supervisor')
    OR usuario_tem_acesso_modulo(auth.uid(), 'vendas')
  );
