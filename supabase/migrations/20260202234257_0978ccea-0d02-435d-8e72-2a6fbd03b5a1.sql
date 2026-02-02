-- Tabela para armazenar insumos/MPs vinculados ao produto acabado
CREATE TABLE public.fabrica_produto_custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  mp_id UUID REFERENCES public.fabrica_materias_primas(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  fornecedor TEXT,
  tipo_insumo TEXT DEFAULT 'bulk',
  custo_nf NUMERIC(15,6) DEFAULT 0,
  custo_servico NUMERIC(15,6) DEFAULT 0,
  custo_condicao NUMERIC(15,6) DEFAULT 0,
  nf_referencia TEXT,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabela para configuração de M.O. e markup por produto
CREATE TABLE public.fabrica_produto_custos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL UNIQUE REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  fornecedor_mao_obra TEXT,
  custo_mao_obra_nf NUMERIC(15,6) DEFAULT 0,
  custo_mao_obra_servico NUMERIC(15,6) DEFAULT 0,
  percentual_markup NUMERIC(10,4) DEFAULT 10,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_fabrica_produto_custos_produto ON public.fabrica_produto_custos(produto_id);
CREATE INDEX idx_fabrica_produto_custos_mp ON public.fabrica_produto_custos(mp_id);
CREATE INDEX idx_fabrica_produto_custos_ordem ON public.fabrica_produto_custos(produto_id, ordem);

-- Habilitar RLS
ALTER TABLE public.fabrica_produto_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabrica_produto_custos_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fabrica_produto_custos
CREATE POLICY "Usuários autenticados podem ver custos de produtos"
  ON public.fabrica_produto_custos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir custos de produtos"
  ON public.fabrica_produto_custos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar custos de produtos"
  ON public.fabrica_produto_custos FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir custos de produtos"
  ON public.fabrica_produto_custos FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para fabrica_produto_custos_config
CREATE POLICY "Usuários autenticados podem ver config de custos"
  ON public.fabrica_produto_custos_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir config de custos"
  ON public.fabrica_produto_custos_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar config de custos"
  ON public.fabrica_produto_custos_config FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem excluir config de custos"
  ON public.fabrica_produto_custos_config FOR DELETE
  TO authenticated
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fabrica_produto_custos_updated_at
  BEFORE UPDATE ON public.fabrica_produto_custos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fabrica_produto_custos_config_updated_at
  BEFORE UPDATE ON public.fabrica_produto_custos_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();