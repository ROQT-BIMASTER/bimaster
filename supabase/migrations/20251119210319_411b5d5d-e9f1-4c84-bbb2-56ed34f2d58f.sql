-- Criar tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS fabrica_movimentacoes_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  tipo_movimento VARCHAR(50) NOT NULL, -- entrada, saida, ajuste, transferencia
  quantidade DECIMAL(15,3) NOT NULL,
  quantidade_anterior DECIMAL(15,3),
  quantidade_nova DECIMAL(15,3),
  custo_unitario DECIMAL(15,2),
  custo_total DECIMAL(15,2),
  lote VARCHAR(100),
  data_validade DATE,
  nota_fiscal_id UUID REFERENCES fabrica_notas_fiscais(id),
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  responsavel_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Índices para performance
CREATE INDEX idx_movimentacoes_mp ON fabrica_movimentacoes_estoque(mp_id);
CREATE INDEX idx_movimentacoes_data ON fabrica_movimentacoes_estoque(created_at);
CREATE INDEX idx_movimentacoes_tipo ON fabrica_movimentacoes_estoque(tipo_movimento);
CREATE INDEX idx_movimentacoes_lote ON fabrica_movimentacoes_estoque(lote);

-- Adicionar campos de cubagem na tabela de dados fiscais (se não existirem)
ALTER TABLE fabrica_dados_fiscais_produto 
ADD COLUMN IF NOT EXISTS altura DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS largura DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS comprimento DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS volume_m3 DECIMAL(10,4) GENERATED ALWAYS AS ((altura * largura * comprimento) / 1000000) STORED;

-- RLS Policies para movimentações
ALTER TABLE fabrica_movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver movimentações"
ON fabrica_movimentacoes_estoque FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
  )
);

CREATE POLICY "Usuários com permissão fabrica podem inserir movimentações"
ON fabrica_movimentacoes_estoque FOR INSERT
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
  )
);

CREATE POLICY "Admins e supervisores podem gerenciar movimentações"
ON fabrica_movimentacoes_estoque FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Comentários
COMMENT ON TABLE fabrica_movimentacoes_estoque IS 'Histórico de todas as movimentações de estoque de matérias-primas';
COMMENT ON COLUMN fabrica_movimentacoes_estoque.tipo_movimento IS 'Tipos: entrada, saida, ajuste, transferencia';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.volume_m3 IS 'Volume calculado automaticamente em metros cúbicos';