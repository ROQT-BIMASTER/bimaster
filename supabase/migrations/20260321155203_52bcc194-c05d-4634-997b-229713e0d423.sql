
-- Enum for solicitation status
CREATE TYPE public.trade_material_status AS ENUM ('pendente', 'aprovado', 'em_separacao', 'enviado', 'entregue', 'recusado');

-- Trade materials catalog
CREATE TABLE public.trade_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  foto_url TEXT,
  fotos_extras JSONB DEFAULT '[]'::jsonb,
  estoque_total INTEGER NOT NULL DEFAULT 0,
  estoque_minimo INTEGER NOT NULL DEFAULT 0,
  estoque_atual INTEGER NOT NULL DEFAULT 0,
  max_por_solicitacao INTEGER DEFAULT 5,
  max_por_loja_mes INTEGER DEFAULT 10,
  prazo_entrega TEXT DEFAULT '5 a 10 dias úteis',
  politica_uso TEXT,
  exibir_estoque BOOLEAN NOT NULL DEFAULT true,
  permitir_sem_estoque BOOLEAN NOT NULL DEFAULT false,
  requer_aprovacao BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material solicitations
CREATE TABLE public.trade_material_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.trade_materiais(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  loja_id UUID,
  loja_nome TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  status public.trade_material_status NOT NULL DEFAULT 'pendente',
  motivo_recusa TEXT,
  codigo_rastreio TEXT,
  obs_interna TEXT,
  aprovado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_material_solicitacoes ENABLE ROW LEVEL SECURITY;

-- RLS for trade_materiais: authenticated can read active, admin can CRUD
CREATE POLICY "Anyone authenticated can view active materials"
  ON public.trade_materiais FOR SELECT TO authenticated
  USING (ativo = true);

CREATE POLICY "Admin can manage all materials"
  ON public.trade_materiais FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS for trade_material_solicitacoes
CREATE POLICY "Users can view own solicitations"
  ON public.trade_material_solicitacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all solicitations"
  ON public.trade_material_solicitacoes FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create solicitations"
  ON public.trade_material_solicitacoes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update solicitations"
  ON public.trade_material_solicitacoes FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Index for performance
CREATE INDEX idx_trade_materiais_ativo ON public.trade_materiais(ativo);
CREATE INDEX idx_trade_material_solicitacoes_user ON public.trade_material_solicitacoes(user_id);
CREATE INDEX idx_trade_material_solicitacoes_status ON public.trade_material_solicitacoes(status);
CREATE INDEX idx_trade_material_solicitacoes_material ON public.trade_material_solicitacoes(material_id);
