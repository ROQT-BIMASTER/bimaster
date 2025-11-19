-- Melhorias em matérias-primas para MRP
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS lead_time_dias INTEGER DEFAULT 7;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS lote_minimo_compra NUMERIC DEFAULT 1;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS estoque_seguranca NUMERIC DEFAULT 0;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS ponto_reposicao NUMERIC;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS ultima_compra_data DATE;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS ultima_compra_preco NUMERIC;
ALTER TABLE fabrica_materias_primas ADD COLUMN IF NOT EXISTS preco_medio_ponderado NUMERIC;

-- Nova: Planejamento de Necessidades (MRP)
CREATE TABLE IF NOT EXISTS fabrica_planejamento_necessidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  data_necessidade DATE NOT NULL,
  quantidade_necessaria NUMERIC NOT NULL,
  quantidade_disponivel NUMERIC,
  quantidade_a_comprar NUMERIC,
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  status VARCHAR(30) DEFAULT 'planejado',
  data_sugestao_compra DATE,
  sugestao_gerada_em TIMESTAMP DEFAULT now(),
  compra_realizada_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- Nova: Histórico de Compras
CREATE TABLE IF NOT EXISTS fabrica_compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES fabrica_fornecedores(id),
  quantidade NUMERIC NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  preco_total NUMERIC NOT NULL,
  data_pedido DATE NOT NULL,
  data_entrega_prevista DATE,
  data_entrega_real DATE,
  lote_recebido VARCHAR(50),
  nota_fiscal VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pedido',
  responsavel_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP DEFAULT now()
);

-- RLS para planejamento
ALTER TABLE fabrica_planejamento_necessidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica veem planejamento"
  ON fabrica_planejamento_necessidades FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Sistema gerencia planejamento"
  ON fabrica_planejamento_necessidades FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- RLS para compras
ALTER TABLE fabrica_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica veem compras"
  ON fabrica_compras FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores gerenciam compras"
  ON fabrica_compras FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));