-- Tabela para armazenar custos por origem do produto
CREATE TABLE public.fabrica_custos_origem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  origem VARCHAR(20) NOT NULL CHECK (origem IN ('nacional', 'importado')),
  custo_base DECIMAL(15,4) NOT NULL DEFAULT 0,
  custo_fob DECIMAL(15,4),
  custo_frete DECIMAL(15,4),
  custo_seguro DECIMAL(15,4),
  custo_impostos DECIMAL(15,4),
  taxa_cambio DECIMAL(10,4),
  moeda_origem VARCHAR(3) DEFAULT 'USD',
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(produto_id, origem, data_referencia)
);

-- Adicionar campo de origem aplicável nas tabelas de preço
ALTER TABLE public.fabrica_tabelas_preco 
ADD COLUMN IF NOT EXISTS origem_aplicavel VARCHAR(20) DEFAULT 'ambos' 
CHECK (origem_aplicavel IN ('nacional', 'importado', 'ambos'));

-- Adicionar campo de origem nos preços de produtos
ALTER TABLE public.fabrica_precos_produtos 
ADD COLUMN IF NOT EXISTS origem VARCHAR(20) DEFAULT 'nacional';

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_fabrica_custos_origem_produto ON public.fabrica_custos_origem(produto_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_custos_origem_origem ON public.fabrica_custos_origem(origem);
CREATE INDEX IF NOT EXISTS idx_fabrica_custos_origem_ativo ON public.fabrica_custos_origem(ativo);
CREATE INDEX IF NOT EXISTS idx_fabrica_precos_produtos_origem ON public.fabrica_precos_produtos(origem);

-- Habilitar RLS
ALTER TABLE public.fabrica_custos_origem ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fabrica_custos_origem
CREATE POLICY "Usuários autenticados podem visualizar custos origem"
ON public.fabrica_custos_origem
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem inserir custos origem"
ON public.fabrica_custos_origem
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar custos origem"
ON public.fabrica_custos_origem
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem deletar custos origem"
ON public.fabrica_custos_origem
FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fabrica_custos_origem_updated_at
BEFORE UPDATE ON public.fabrica_custos_origem
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();