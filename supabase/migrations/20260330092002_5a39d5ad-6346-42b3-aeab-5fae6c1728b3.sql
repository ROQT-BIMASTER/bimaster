
-- ============================================
-- OMS Phase 1: Core Tables
-- ============================================

-- Condições de pagamento
CREATE TABLE public.oms_condicoes_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(20) NOT NULL UNIQUE,
  descricao varchar(255) NOT NULL,
  parcelas int NOT NULL DEFAULT 1,
  dias_entre_parcelas int DEFAULT 30,
  dias_primeira_parcela int DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Pedidos
CREATE TABLE public.oms_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY,
  cliente_codigo varchar(20) NOT NULL,
  cliente_nome varchar(255),
  vendedor_cod int,
  vendedor_nome varchar(255),
  empresa_id int,
  tabela_preco_id uuid,
  condicao_pagamento_id uuid REFERENCES public.oms_condicoes_pagamento(id),
  status varchar(30) NOT NULL DEFAULT 'recebido',
  canal_origem varchar(50) DEFAULT 'manual',
  valor_total numeric(15,2) DEFAULT 0,
  desconto_total numeric(15,2) DEFAULT 0,
  observacao text,
  motivo_rejeicao text,
  idempotency_key varchar(100) UNIQUE,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices para performance (2K pedidos/dia)
CREATE INDEX idx_oms_pedidos_status_created ON public.oms_pedidos (status, created_at DESC);
CREATE INDEX idx_oms_pedidos_cliente ON public.oms_pedidos (cliente_codigo, created_at DESC);
CREATE INDEX idx_oms_pedidos_empresa_status ON public.oms_pedidos (empresa_id, status);
CREATE INDEX idx_oms_pedidos_vendedor ON public.oms_pedidos (vendedor_cod, created_at DESC);
CREATE INDEX idx_oms_pedidos_numero ON public.oms_pedidos (numero);

-- Itens do pedido
CREATE TABLE public.oms_pedido_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.oms_pedidos(id) ON DELETE CASCADE,
  produto_codigo varchar(50) NOT NULL,
  produto_nome varchar(255),
  quantidade numeric(15,4) NOT NULL,
  preco_unitario numeric(15,4) NOT NULL,
  desconto_percentual numeric(5,2) DEFAULT 0,
  valor_total numeric(15,2) NOT NULL,
  estoque_reservado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_oms_pedido_itens_pedido ON public.oms_pedido_itens (pedido_id);

-- Log de status (timeline)
CREATE TABLE public.oms_pedido_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.oms_pedidos(id) ON DELETE CASCADE,
  status_anterior varchar(30),
  status_novo varchar(30) NOT NULL,
  usuario_id uuid,
  usuario_nome varchar(255),
  observacao text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_oms_status_log_pedido ON public.oms_pedido_status_log (pedido_id, created_at DESC);
CREATE INDEX idx_oms_status_log_created ON public.oms_pedido_status_log (created_at DESC);

-- RLS
ALTER TABLE public.oms_condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oms_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oms_pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oms_pedido_status_log ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can read all OMS data
CREATE POLICY "oms_condicoes_select" ON public.oms_condicoes_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "oms_condicoes_insert" ON public.oms_condicoes_pagamento FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "oms_condicoes_update" ON public.oms_condicoes_pagamento FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "oms_pedidos_select" ON public.oms_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "oms_pedidos_insert" ON public.oms_pedidos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "oms_pedidos_update" ON public.oms_pedidos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "oms_pedido_itens_select" ON public.oms_pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "oms_pedido_itens_insert" ON public.oms_pedido_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "oms_pedido_itens_update" ON public.oms_pedido_itens FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "oms_status_log_select" ON public.oms_pedido_status_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "oms_status_log_insert" ON public.oms_pedido_status_log FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime para pedidos
ALTER PUBLICATION supabase_realtime ADD TABLE public.oms_pedidos;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.fn_oms_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oms_pedidos_updated_at
  BEFORE UPDATE ON public.oms_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_oms_set_updated_at();

CREATE TRIGGER trg_oms_condicoes_updated_at
  BEFORE UPDATE ON public.oms_condicoes_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.fn_oms_set_updated_at();

-- Trigger para log automático de mudança de status
CREATE OR REPLACE FUNCTION public.fn_oms_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.oms_pedido_status_log (pedido_id, status_anterior, status_novo, usuario_id)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oms_pedidos_status_log
  AFTER UPDATE ON public.oms_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_oms_log_status_change();
