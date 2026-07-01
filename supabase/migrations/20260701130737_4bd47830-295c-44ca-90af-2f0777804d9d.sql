
-- Scope ERP sales/order reads to the user's empresa (via user_empresas), plus admin/supervisor bypass.

-- erp_pedidos
DROP POLICY IF EXISTS erp_pedidos_select ON public.erp_pedidos;
CREATE POLICY erp_pedidos_select ON public.erp_pedidos
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR EXISTS (
    SELECT 1 FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid() AND ue.empresa_id = erp_pedidos.empresa_id
  )
);

-- erp_vendas
DROP POLICY IF EXISTS erp_vendas_select ON public.erp_vendas;
CREATE POLICY erp_vendas_select ON public.erp_vendas
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR EXISTS (
    SELECT 1 FROM public.user_empresas ue
    WHERE ue.user_id = auth.uid() AND ue.empresa_id = erp_vendas.empresa_id
  )
);

-- erp_pedidos_item (no empresa_id; scope via parent pedido)
DROP POLICY IF EXISTS erp_pedidos_item_select ON public.erp_pedidos_item;
CREATE POLICY erp_pedidos_item_select ON public.erp_pedidos_item
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR EXISTS (
    SELECT 1
    FROM public.erp_pedidos p
    JOIN public.user_empresas ue ON ue.empresa_id = p.empresa_id
    WHERE p.futura_pedido_id = erp_pedidos_item.futura_pedido_id
      AND ue.user_id = auth.uid()
  )
);

-- erp_vendas_item (no empresa_id; scope via parent nota)
DROP POLICY IF EXISTS erp_vendas_item_select ON public.erp_vendas_item;
CREATE POLICY erp_vendas_item_select ON public.erp_vendas_item
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
  OR EXISTS (
    SELECT 1
    FROM public.erp_vendas v
    JOIN public.user_empresas ue ON ue.empresa_id = v.empresa_id
    WHERE v.futura_nota_id = erp_vendas_item.futura_nota_id
      AND ue.user_id = auth.uid()
  )
);

-- Support indexes for the semi-joins above
CREATE INDEX IF NOT EXISTS idx_user_empresas_user_empresa ON public.user_empresas(user_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_futura_pedido_id ON public.erp_pedidos(futura_pedido_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_empresa_id ON public.erp_pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_futura_nota_id ON public.erp_vendas(futura_nota_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_empresa_id ON public.erp_vendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_item_futura_pedido_id ON public.erp_pedidos_item(futura_pedido_id);
CREATE INDEX IF NOT EXISTS idx_erp_vendas_item_futura_nota_id ON public.erp_vendas_item(futura_nota_id);
