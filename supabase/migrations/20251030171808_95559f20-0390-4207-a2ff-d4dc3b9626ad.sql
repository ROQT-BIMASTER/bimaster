-- Criar tabela de categorias de lojas
CREATE TABLE IF NOT EXISTS public.store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de redes de lojas
CREATE TABLE IF NOT EXISTS public.store_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cnpj VARCHAR(20),
  contact_name VARCHAR(200),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(20),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Criar tabela de histórico de share de prateleira
CREATE TABLE IF NOT EXISTS public.shelf_share_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  shelf_share_percentage NUMERIC,
  facing_share_percentage NUMERIC,
  total_facings INTEGER,
  our_facings INTEGER,
  competitor_facings INTEGER,
  total_width_cm NUMERIC,
  our_width_cm NUMERIC,
  competitor_width_cm NUMERIC,
  products_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_shelf_share_history_store_date ON public.shelf_share_history(store_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_store_chains_active ON public.store_chains(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_store_categories_active ON public.store_categories(active) WHERE active = true;

-- RLS Policies para store_categories
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver categorias ativas" ON public.store_categories;
CREATE POLICY "Usuários autenticados podem ver categorias ativas"
  ON public.store_categories FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Admins e supervisores podem gerenciar categorias" ON public.store_categories;
CREATE POLICY "Admins e supervisores podem gerenciar categorias"
  ON public.store_categories FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies para store_chains
ALTER TABLE public.store_chains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários autenticados podem ver redes ativas" ON public.store_chains;
CREATE POLICY "Usuários autenticados podem ver redes ativas"
  ON public.store_chains FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Admins e supervisores podem gerenciam redes" ON public.store_chains;
CREATE POLICY "Admins e supervisores podem gerenciar redes"
  ON public.store_chains FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies para shelf_share_history
ALTER TABLE public.shelf_share_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem ver histórico de suas lojas" ON public.shelf_share_history;
CREATE POLICY "Usuários podem ver histórico de suas lojas"
  ON public.shelf_share_history FOR SELECT
  USING (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = shelf_share_history.store_id
      AND (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM visits v
          WHERE v.store_id = s.id AND v.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Usuários podem criar histórico de share" ON public.shelf_share_history;
CREATE POLICY "Usuários podem criar histórico de share"
  ON public.shelf_share_history FOR INSERT
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Criadores podem atualizar seu histórico" ON public.shelf_share_history;
CREATE POLICY "Criadores podem atualizar seu histórico"
  ON public.shelf_share_history FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Admins podem deletar histórico" ON public.shelf_share_history;
CREATE POLICY "Admins podem deletar histórico"
  ON public.shelf_share_history FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Comentários
COMMENT ON TABLE public.store_categories IS 'Categorias de pontos de venda para classificação';
COMMENT ON TABLE public.store_chains IS 'Redes de lojas para vincular aos PDVs';
COMMENT ON TABLE public.shelf_share_history IS 'Histórico de share de prateleira para análise temporal';