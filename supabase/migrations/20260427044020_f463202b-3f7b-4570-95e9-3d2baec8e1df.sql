-- ============================================================
-- 1.1 Vínculo OC China <-> OP/Compra/MP Brasil
-- ============================================================
CREATE TABLE public.compras_internacional_vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  china_ordem_compra_id UUID NOT NULL REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  china_ordem_item_id UUID REFERENCES public.china_ordem_itens(id) ON DELETE SET NULL,
  fabrica_op_id UUID REFERENCES public.fabrica_ordens_producao(id) ON DELETE SET NULL,
  fabrica_compra_id UUID REFERENCES public.fabrica_compras(id) ON DELETE SET NULL,
  fabrica_mp_id UUID REFERENCES public.fabrica_materias_primas(id) ON DELETE SET NULL,
  qty_alocada NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_destino_brasil CHECK (
    fabrica_op_id IS NOT NULL OR fabrica_compra_id IS NOT NULL OR fabrica_mp_id IS NOT NULL
  )
);

CREATE INDEX idx_civ_china_oc ON public.compras_internacional_vinculos(china_ordem_compra_id);
CREATE INDEX idx_civ_china_item ON public.compras_internacional_vinculos(china_ordem_item_id);
CREATE INDEX idx_civ_op ON public.compras_internacional_vinculos(fabrica_op_id);
CREATE INDEX idx_civ_compra ON public.compras_internacional_vinculos(fabrica_compra_id);

ALTER TABLE public.compras_internacional_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios china/fabrica leem vinculos"
  ON public.compras_internacional_vinculos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid() AND ms.codigo IN ('china', 'fabrica')
    )
  );

CREATE POLICY "Admin/supervisor gerencia vinculos"
  ON public.compras_internacional_vinculos FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- ============================================================
-- 1.2 Itemização de compras nacionais
-- ============================================================
CREATE TABLE public.fabrica_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.fabrica_compras(id) ON DELETE CASCADE,
  mp_id UUID REFERENCES public.fabrica_materias_primas(id),
  descricao TEXT,
  qty_pedida NUMERIC NOT NULL DEFAULT 0,
  qty_recebida NUMERIC NOT NULL DEFAULT 0,
  qty_cancelada NUMERIC NOT NULL DEFAULT 0,
  preco_unitario NUMERIC,
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fci_compra ON public.fabrica_compra_itens(compra_id);
CREATE INDEX idx_fci_mp ON public.fabrica_compra_itens(mp_id);

ALTER TABLE public.fabrica_compra_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fabrica le itens de compra"
  ON public.fabrica_compra_itens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid() AND ms.codigo = 'fabrica'
    )
  );

CREATE POLICY "Admin/supervisor gerencia itens de compra"
  ON public.fabrica_compra_itens FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- ============================================================
-- 1.3 Recebimentos parciais de compras nacionais
-- ============================================================
CREATE TABLE public.fabrica_compra_recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES public.fabrica_compras(id) ON DELETE CASCADE,
  numero_recebimento INTEGER NOT NULL DEFAULT 1,
  data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  nota_fiscal TEXT,
  observacoes TEXT,
  recebido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fcr_compra ON public.fabrica_compra_recebimentos(compra_id);

ALTER TABLE public.fabrica_compra_recebimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fabrica le recebimentos"
  ON public.fabrica_compra_recebimentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid() AND ms.codigo = 'fabrica'
    )
  );

CREATE POLICY "Admin/supervisor gerencia recebimentos"
  ON public.fabrica_compra_recebimentos FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE TABLE public.fabrica_compra_recebimento_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recebimento_id UUID NOT NULL REFERENCES public.fabrica_compra_recebimentos(id) ON DELETE CASCADE,
  compra_item_id UUID NOT NULL REFERENCES public.fabrica_compra_itens(id) ON DELETE CASCADE,
  qty_recebida NUMERIC NOT NULL,
  divergencia NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fcri_receb ON public.fabrica_compra_recebimento_itens(recebimento_id);
CREATE INDEX idx_fcri_item ON public.fabrica_compra_recebimento_itens(compra_item_id);

ALTER TABLE public.fabrica_compra_recebimento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fabrica le itens de recebimento"
  ON public.fabrica_compra_recebimento_itens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE upm.usuario_id = auth.uid() AND ms.codigo = 'fabrica'
    )
  );

CREATE POLICY "Admin/supervisor gerencia itens de recebimento"
  ON public.fabrica_compra_recebimento_itens FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- ============================================================
-- 1.4 Trigger: atualizar saldo do item ao receber
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_atualizar_saldo_compra_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra_id UUID;
  v_total_pedido NUMERIC;
  v_total_recebido NUMERIC;
BEGIN
  -- Recalcula qty_recebida do item
  UPDATE public.fabrica_compra_itens fci
  SET qty_recebida = COALESCE((
        SELECT SUM(qty_recebida)
        FROM public.fabrica_compra_recebimento_itens
        WHERE compra_item_id = COALESCE(NEW.compra_item_id, OLD.compra_item_id)
      ), 0),
      status = CASE
        WHEN COALESCE((
          SELECT SUM(qty_recebida)
          FROM public.fabrica_compra_recebimento_itens
          WHERE compra_item_id = COALESCE(NEW.compra_item_id, OLD.compra_item_id)
        ), 0) >= (fci.qty_pedida - fci.qty_cancelada) THEN 'fechado'
        WHEN COALESCE((
          SELECT SUM(qty_recebida)
          FROM public.fabrica_compra_recebimento_itens
          WHERE compra_item_id = COALESCE(NEW.compra_item_id, OLD.compra_item_id)
        ), 0) > 0 THEN 'parcial'
        ELSE 'aberto'
      END,
      updated_at = now()
  WHERE id = COALESCE(NEW.compra_item_id, OLD.compra_item_id)
  RETURNING compra_id INTO v_compra_id;

  -- Atualiza status da compra cabeçalho
  IF v_compra_id IS NOT NULL THEN
    SELECT
      SUM(qty_pedida - qty_cancelada),
      SUM(qty_recebida)
    INTO v_total_pedido, v_total_recebido
    FROM public.fabrica_compra_itens
    WHERE compra_id = v_compra_id;

    UPDATE public.fabrica_compras
    SET status = CASE
      WHEN v_total_recebido >= v_total_pedido AND v_total_pedido > 0 THEN 'recebido_total'
      WHEN v_total_recebido > 0 THEN 'recebido_parcial'
      ELSE status
    END
    WHERE id = v_compra_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_atualizar_saldo_compra_item
AFTER INSERT OR UPDATE OR DELETE ON public.fabrica_compra_recebimento_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_atualizar_saldo_compra_item();

-- ============================================================
-- 1.5 Trigger: updated_at em vinculos e itens
-- ============================================================
CREATE TRIGGER trg_civ_updated_at
BEFORE UPDATE ON public.compras_internacional_vinculos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_fci_updated_at
BEFORE UPDATE ON public.fabrica_compra_itens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 1.6 View consolidada de pendências
-- ============================================================
CREATE OR REPLACE VIEW public.v_compras_pendencias AS
SELECT
  'china'::text AS origem,
  oc.id AS oc_id,
  oc.numero_oc AS numero,
  oi.id AS item_id,
  COALESCE(oi.cor_nome, oi.sku, 'Único') AS descricao,
  oc.produto_nome,
  oi.qty_pedida::numeric AS qty_pedida,
  oi.qty_produzida::numeric AS qty_produzida,
  oi.qty_embarcada::numeric AS qty_embarcada,
  oi.qty_recebida::numeric AS qty_recebida,
  oi.qty_cancelada::numeric AS qty_cancelada,
  GREATEST(0, oi.qty_pedida - oi.qty_cancelada - oi.qty_recebida)::numeric AS qty_pendente,
  oc.data_entrega_prevista,
  oc.status,
  oc.created_at
FROM public.china_ordens_compra oc
JOIN public.china_ordem_itens oi ON oi.ordem_compra_id = oc.id
UNION ALL
SELECT
  'brasil'::text AS origem,
  c.id AS oc_id,
  COALESCE(c.nota_fiscal, c.id::text) AS numero,
  ci.id AS item_id,
  COALESCE(ci.descricao, mp.nome, 'Item') AS descricao,
  mp.nome AS produto_nome,
  ci.qty_pedida AS qty_pedida,
  NULL::numeric AS qty_produzida,
  NULL::numeric AS qty_embarcada,
  ci.qty_recebida AS qty_recebida,
  ci.qty_cancelada AS qty_cancelada,
  GREATEST(0, ci.qty_pedida - ci.qty_cancelada - ci.qty_recebida) AS qty_pendente,
  c.data_entrega_prevista,
  c.status::text,
  c.created_at::timestamptz
FROM public.fabrica_compras c
JOIN public.fabrica_compra_itens ci ON ci.compra_id = c.id
LEFT JOIN public.fabrica_materias_primas mp ON mp.id = ci.mp_id;

-- View herda RLS das tabelas-fonte (security_invoker)
ALTER VIEW public.v_compras_pendencias SET (security_invoker = on);