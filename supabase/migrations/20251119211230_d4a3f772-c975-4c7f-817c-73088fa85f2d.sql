-- Criar tabela de lotes para rastreabilidade
CREATE TABLE IF NOT EXISTS fabrica_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  nota_fiscal_id UUID REFERENCES fabrica_notas_fiscais(id) ON DELETE SET NULL,
  codigo_lote VARCHAR(100) NOT NULL,
  data_fabricacao DATE,
  data_validade DATE,
  quantidade_inicial NUMERIC(15,4) NOT NULL,
  quantidade_atual NUMERIC(15,4) NOT NULL,
  custo_unitario NUMERIC(15,4) NOT NULL,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'esgotado', 'vencido', 'bloqueado')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar índices para performance
CREATE INDEX idx_fabrica_lotes_produto ON fabrica_lotes(produto_id);
CREATE INDEX idx_fabrica_lotes_nota ON fabrica_lotes(nota_fiscal_id);
CREATE INDEX idx_fabrica_lotes_validade ON fabrica_lotes(data_validade);
CREATE INDEX idx_fabrica_lotes_status ON fabrica_lotes(status);

-- Adicionar campos de conferência à tabela de notas fiscais
ALTER TABLE fabrica_notas_fiscais 
  ADD COLUMN IF NOT EXISTS conferido_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS data_conferencia TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS divergencias_conferencia JSONB,
  ADD COLUMN IF NOT EXISTS justificativa_divergencias TEXT;

-- Atualizar status para incluir estados de conferência
ALTER TABLE fabrica_notas_fiscais 
  DROP CONSTRAINT IF EXISTS fabrica_notas_fiscais_status_check;
  
ALTER TABLE fabrica_notas_fiscais 
  ADD CONSTRAINT fabrica_notas_fiscais_status_check 
  CHECK (status IN ('imported', 'under_conference', 'conferenced', 'integrated', 'rejected'));

-- Adicionar campos de custo médio e método de custeio
ALTER TABLE fabrica_materias_primas
  ADD COLUMN IF NOT EXISTS metodo_custeio VARCHAR(20) DEFAULT 'FIFO' CHECK (metodo_custeio IN ('FIFO', 'MEDIA_PONDERADA'));

-- Tabela para histórico de custos (auditoria)
CREATE TABLE IF NOT EXISTS fabrica_historico_custos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  custo_anterior NUMERIC(15,4),
  custo_novo NUMERIC(15,4) NOT NULL,
  quantidade_movimento NUMERIC(15,4) NOT NULL,
  tipo_movimento VARCHAR(50) NOT NULL,
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_fabrica_historico_custos_produto ON fabrica_historico_custos(produto_id);
CREATE INDEX idx_fabrica_historico_custos_data ON fabrica_historico_custos(created_at);

-- Adicionar campos de quantidade conferida aos itens da NF
ALTER TABLE fabrica_itens_nf
  ADD COLUMN IF NOT EXISTS quantidade_conferida NUMERIC(15,4),
  ADD COLUMN IF NOT EXISTS divergencia_percentual NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS observacoes_conferencia TEXT,
  ADD COLUMN IF NOT EXISTS conferido BOOLEAN DEFAULT false;

-- RLS Policies para fabrica_lotes
ALTER TABLE fabrica_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver lotes"
  ON fabrica_lotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica podem criar lotes"
  ON fabrica_lotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica podem atualizar lotes"
  ON fabrica_lotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores podem deletar lotes"
  ON fabrica_lotes FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies para fabrica_historico_custos
ALTER TABLE fabrica_historico_custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver histórico de custos"
  ON fabrica_historico_custos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode inserir histórico de custos"
  ON fabrica_historico_custos FOR INSERT
  WITH CHECK (true);

-- Função para calcular custo médio FIFO
CREATE OR REPLACE FUNCTION calcular_custo_medio_fifo(
  p_produto_id UUID,
  p_quantidade_saida NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_custo_total NUMERIC := 0;
  v_quantidade_restante NUMERIC := p_quantidade_saida;
  v_lote RECORD;
BEGIN
  -- Buscar lotes do mais antigo para o mais novo (FIFO)
  FOR v_lote IN 
    SELECT id, quantidade_atual, custo_unitario
    FROM fabrica_lotes
    WHERE produto_id = p_produto_id 
      AND status = 'ativo' 
      AND quantidade_atual > 0
    ORDER BY created_at ASC
  LOOP
    IF v_quantidade_restante <= 0 THEN
      EXIT;
    END IF;
    
    IF v_lote.quantidade_atual >= v_quantidade_restante THEN
      v_custo_total := v_custo_total + (v_quantidade_restante * v_lote.custo_unitario);
      v_quantidade_restante := 0;
    ELSE
      v_custo_total := v_custo_total + (v_lote.quantidade_atual * v_lote.custo_unitario);
      v_quantidade_restante := v_quantidade_restante - v_lote.quantidade_atual;
    END IF;
  END LOOP;
  
  IF v_quantidade_restante > 0 THEN
    RAISE EXCEPTION 'Quantidade insuficiente em estoque';
  END IF;
  
  RETURN v_custo_total / p_quantidade_saida;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular custo médio ponderado
CREATE OR REPLACE FUNCTION calcular_custo_medio_ponderado(
  p_produto_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_custo_total NUMERIC := 0;
  v_quantidade_total NUMERIC := 0;
BEGIN
  SELECT 
    COALESCE(SUM(quantidade_atual * custo_unitario), 0),
    COALESCE(SUM(quantidade_atual), 0)
  INTO v_custo_total, v_quantidade_total
  FROM fabrica_lotes
  WHERE produto_id = p_produto_id 
    AND status = 'ativo' 
    AND quantidade_atual > 0;
  
  IF v_quantidade_total = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN v_custo_total / v_quantidade_total;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar custo unitário do produto
CREATE OR REPLACE FUNCTION atualizar_custo_produto()
RETURNS TRIGGER AS $$
DECLARE
  v_custo_novo NUMERIC;
  v_metodo_custeio VARCHAR(20);
BEGIN
  -- Buscar método de custeio do produto
  SELECT metodo_custeio INTO v_metodo_custeio
  FROM fabrica_materias_primas
  WHERE id = NEW.produto_id;
  
  -- Calcular novo custo baseado no método
  IF v_metodo_custeio = 'FIFO' THEN
    -- Para FIFO, o custo unitário será calculado dinamicamente nas saídas
    -- Aqui apenas atualizamos com o custo médio atual
    v_custo_novo := calcular_custo_medio_ponderado(NEW.produto_id);
  ELSE
    -- Média ponderada
    v_custo_novo := calcular_custo_medio_ponderado(NEW.produto_id);
  END IF;
  
  -- Atualizar custo unitário do produto
  UPDATE fabrica_materias_primas
  SET 
    custo_unitario = v_custo_novo,
    preco_medio_ponderado = v_custo_novo,
    updated_at = now()
  WHERE id = NEW.produto_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_custo_produto
  AFTER INSERT OR UPDATE ON fabrica_lotes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_custo_produto();

-- Trigger para atualizar status do lote quando quantidade zerar
CREATE OR REPLACE FUNCTION atualizar_status_lote()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantidade_atual <= 0 THEN
    NEW.status := 'esgotado';
  END IF;
  
  IF NEW.data_validade IS NOT NULL AND NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_status_lote
  BEFORE UPDATE ON fabrica_lotes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_status_lote();