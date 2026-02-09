
-- 1. Adicionar colunas na tabela fabrica_produto_custos_config
ALTER TABLE public.fabrica_produto_custos_config
  ADD COLUMN status_aprovacao text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN revisao_ativa_id uuid;

-- 2. Criar tabela de revisões
CREATE TABLE public.fabrica_ficha_custo_revisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.fabrica_produto_custos_config(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente',
  snapshot_insumos jsonb,
  snapshot_config jsonb,
  snapshot_totais jsonb,
  submetido_por uuid REFERENCES auth.users(id),
  submetido_em timestamptz NOT NULL DEFAULT now(),
  revisado_por uuid REFERENCES auth.users(id),
  revisado_em timestamptz,
  parecer text,
  versao integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Criar tabela de itens de revisão (apontamentos)
CREATE TABLE public.fabrica_ficha_custo_revisao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id uuid NOT NULL REFERENCES public.fabrica_ficha_custo_revisoes(id) ON DELETE CASCADE,
  insumo_id uuid REFERENCES public.fabrica_produto_custos(id) ON DELETE SET NULL,
  campo text NOT NULL,
  valor_atual numeric NOT NULL DEFAULT 0,
  valor_sugerido numeric NOT NULL DEFAULT 0,
  comentario text,
  atendido boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. FK da revisao_ativa_id
ALTER TABLE public.fabrica_produto_custos_config
  ADD CONSTRAINT fk_revisao_ativa
  FOREIGN KEY (revisao_ativa_id) REFERENCES public.fabrica_ficha_custo_revisoes(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX idx_revisoes_config_id ON public.fabrica_ficha_custo_revisoes(config_id);
CREATE INDEX idx_revisoes_produto_id ON public.fabrica_ficha_custo_revisoes(produto_id);
CREATE INDEX idx_revisoes_status ON public.fabrica_ficha_custo_revisoes(status);
CREATE INDEX idx_revisao_itens_revisao_id ON public.fabrica_ficha_custo_revisao_itens(revisao_id);

-- 6. RLS - fabrica_ficha_custo_revisoes
ALTER TABLE public.fabrica_ficha_custo_revisoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view revisoes"
  ON public.fabrica_ficha_custo_revisoes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can create revisoes"
  ON public.fabrica_ficha_custo_revisoes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = submetido_por);

CREATE POLICY "Admins can update revisoes"
  ON public.fabrica_ficha_custo_revisoes FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
  );

-- 7. RLS - fabrica_ficha_custo_revisao_itens
ALTER TABLE public.fabrica_ficha_custo_revisao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view revisao_itens"
  ON public.fabrica_ficha_custo_revisao_itens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert revisao_itens"
  ON public.fabrica_ficha_custo_revisao_itens FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
  );

CREATE POLICY "Admins can update revisao_itens"
  ON public.fabrica_ficha_custo_revisao_itens FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor')
  );
