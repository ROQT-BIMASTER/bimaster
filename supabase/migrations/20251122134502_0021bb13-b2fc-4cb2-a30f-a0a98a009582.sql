-- ========================================
-- CORREÇÕES ESTRUTURAIS DO SISTEMA FISCAL
-- Baseado em: EFD ICMS/IPI, Teoria Contábil e Fiscal
-- ========================================

-- 1. ADICIONAR CAMPOS FALTANTES NA TABELA DE ITENS DE NF
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS valor_ipi DECIMAL(15,2) DEFAULT 0;
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS aliquota_ipi DECIMAL(5,2);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS cst_ipi VARCHAR(10);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS valor_icms_st DECIMAL(15,2) DEFAULT 0;
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS base_icms_st DECIMAL(15,2);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS aliquota_icms_st DECIMAL(5,2);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS base_icms DECIMAL(15,2);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS base_pis DECIMAL(15,2);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS base_cofins DECIMAL(15,2);

-- Campos para custo calculado (importante!)
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS custo_unitario_entrada DECIMAL(15,4);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS custo_total_entrada DECIMAL(15,2);

-- Campos para validação fiscal
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS validado_fiscalmente BOOLEAN DEFAULT FALSE;
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES auth.users(id);
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS validado_em TIMESTAMPTZ;
ALTER TABLE fabrica_itens_nf ADD COLUMN IF NOT EXISTS observacoes_fiscais TEXT;

-- 2. TABELA DE HISTÓRICO DE VALIDAÇÕES FISCAIS
CREATE TABLE IF NOT EXISTS fabrica_validacoes_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_nf_id UUID NOT NULL REFERENCES fabrica_itens_nf(id) ON DELETE CASCADE,
  nota_id UUID NOT NULL REFERENCES fabrica_notas_fiscais(id) ON DELETE CASCADE,
  
  -- Dados antes da validação
  dados_originais JSONB NOT NULL,
  
  -- Dados após ajustes
  dados_validados JSONB NOT NULL,
  
  -- Flags de validação
  ajustes_realizados BOOLEAN DEFAULT FALSE,
  tipos_ajustes TEXT[], -- ['cst_icms', 'aliquota_icms', 'valor_icms']
  
  -- Resultado da validação
  custo_entrada_calculado DECIMAL(15,4) NOT NULL,
  creditos_gerados JSONB, -- {icms: 100.00, pis: 16.50, cofins: 76.00}
  
  -- Auditoria
  validado_por UUID NOT NULL REFERENCES auth.users(id),
  validado_em TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validacoes_fiscais_item ON fabrica_validacoes_fiscais(item_nf_id);
CREATE INDEX IF NOT EXISTS idx_validacoes_fiscais_nota ON fabrica_validacoes_fiscais(nota_id);

-- 3. FUNÇÃO PARA BUSCAR REGRA FISCAL AUTOMATICAMENTE
-- Esta função será usada no frontend e backend para determinar impostos corretos
CREATE OR REPLACE FUNCTION buscar_regra_fiscal_item(
  p_ncm TEXT,
  p_uf_origem TEXT,
  p_uf_destino TEXT,
  p_tipo_operacao TEXT DEFAULT 'entrada'
) RETURNS TABLE (
  regra_id UUID,
  cst_entrada TEXT,
  cst_saida TEXT,
  aliquota_icms DECIMAL,
  aliquota_fcp DECIMAL,
  tem_st BOOLEAN,
  mva DECIMAL,
  reducao_base DECIMAL,
  cfop_entrada TEXT,
  cfop_saida TEXT,
  aliquota_pis DECIMAL,
  aliquota_cofins DECIMAL,
  aliquota_ipi DECIMAL,
  comentario TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rf.id,
    rf.cst_entrada,
    rf.cst_saida,
    rf.aliquota_icms,
    rf.aliquota_fcp,
    rf.tem_st,
    rf.mva,
    rf.reducao_base,
    rf.cfop_entrada,
    rf.cfop_saida,
    rf.pis,
    rf.cofins,
    COALESCE(ncm.aliquota_ipi, 0::decimal) as aliquota_ipi,
    rf.comentario
  FROM fabrica_regras_fiscais_ncm rf
  LEFT JOIN fabrica_ncm ncm ON ncm.codigo = rf.ncm
  WHERE rf.ncm = p_ncm
    AND rf.uf_origem = p_uf_origem
    AND rf.uf_destino = p_uf_destino
    AND rf.ativo = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNÇÃO PARA CALCULAR CUSTO DE ENTRADA (TEORIA CONTÁBIL)
CREATE OR REPLACE FUNCTION calcular_custo_entrada(
  p_valor_produto DECIMAL,
  p_valor_ipi DECIMAL DEFAULT 0,
  p_valor_icms_st DECIMAL DEFAULT 0,
  p_valor_frete DECIMAL DEFAULT 0,
  p_valor_seguro DECIMAL DEFAULT 0,
  p_outras_despesas DECIMAL DEFAULT 0,
  p_valor_desconto DECIMAL DEFAULT 0
) RETURNS DECIMAL AS $$
DECLARE
  v_custo_entrada DECIMAL;
BEGIN
  -- Fórmula correta segundo teoria contábil:
  -- Custo = Valor Produto + IPI + ICMS ST + Frete + Seguro + Outras Despesas - Descontos
  -- ICMS próprio NÃO entra no custo (é recuperável)
  
  v_custo_entrada := p_valor_produto 
                   + COALESCE(p_valor_ipi, 0)
                   + COALESCE(p_valor_icms_st, 0)
                   + COALESCE(p_valor_frete, 0)
                   + COALESCE(p_valor_seguro, 0)
                   + COALESCE(p_outras_despesas, 0)
                   - COALESCE(p_valor_desconto, 0);
  
  RETURN v_custo_entrada;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. FUNÇÃO PARA GERAR CRÉDITOS TRIBUTÁRIOS AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION gerar_creditos_tributarios(
  p_item_nf_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_credito_icms DECIMAL := 0;
  v_credito_pis DECIMAL := 0;
  v_credito_cofins DECIMAL := 0;
  v_credito_ipi DECIMAL := 0;
  v_periodo TEXT;
  v_result JSONB;
BEGIN
  -- Buscar dados do item
  SELECT 
    inf.*,
    nf.data_emissao,
    nf.numero,
    nf.serie,
    mp.id as produto_id
  INTO v_item
  FROM fabrica_itens_nf inf
  JOIN fabrica_notas_fiscais nf ON nf.id = inf.nota_id
  LEFT JOIN fabrica_materias_primas mp ON mp.id = inf.produto_interno_id
  WHERE inf.id = p_item_nf_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;
  
  -- Determinar período de apuração (formato YYYY-MM)
  v_periodo := TO_CHAR(v_item.data_emissao, 'YYYY-MM');
  
  -- ICMS: Verificar se gera crédito
  IF v_item.gera_credito_icms AND v_item.valor_icms > 0 THEN
    v_credito_icms := v_item.valor_icms;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id,
      nota_id,
      tipo_credito,
      valor_credito,
      saldo_credito,
      data_credito,
      periodo_apuracao,
      status,
      cst,
      cfop,
      aliquota,
      base_calculo
    ) VALUES (
      v_item.produto_id,
      v_item.nota_id,
      'icms_proprio',
      v_credito_icms,
      v_credito_icms,
      v_item.data_emissao,
      v_periodo,
      'disponivel',
      v_item.cst_icms,
      v_item.cfop,
      v_item.aliquota_icms,
      v_item.base_icms
    );
  END IF;
  
  -- PIS: Verificar se gera crédito
  IF v_item.gera_credito_pis AND v_item.valor_pis > 0 THEN
    v_credito_pis := v_item.valor_pis;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id,
      nota_id,
      tipo_credito,
      valor_credito,
      saldo_credito,
      data_credito,
      periodo_apuracao,
      status,
      cst,
      cfop,
      aliquota,
      base_calculo
    ) VALUES (
      v_item.produto_id,
      v_item.nota_id,
      'pis',
      v_credito_pis,
      v_credito_pis,
      v_item.data_emissao,
      v_periodo,
      'disponivel',
      v_item.cst_pis,
      v_item.cfop,
      v_item.aliquota_pis,
      v_item.base_pis
    );
  END IF;
  
  -- COFINS: Verificar se gera crédito
  IF v_item.gera_credito_cofins AND v_item.valor_cofins > 0 THEN
    v_credito_cofins := v_item.valor_cofins;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id,
      nota_id,
      tipo_credito,
      valor_credito,
      saldo_credito,
      data_credito,
      periodo_apuracao,
      status,
      cst,
      cfop,
      aliquota,
      base_calculo
    ) VALUES (
      v_item.produto_id,
      v_item.nota_id,
      'cofins',
      v_credito_cofins,
      v_credito_cofins,
      v_item.data_emissao,
      v_periodo,
      'disponivel',
      v_item.cst_cofins,
      v_item.cfop,
      v_item.aliquota_cofins,
      v_item.base_cofins
    );
  END IF;
  
  -- IPI: Verificar se gera crédito (raro, mas existe)
  IF v_item.gera_credito_ipi AND v_item.valor_ipi > 0 THEN
    v_credito_ipi := v_item.valor_ipi;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id,
      nota_id,
      tipo_credito,
      valor_credito,
      saldo_credito,
      data_credito,
      periodo_apuracao,
      status,
      cst,
      cfop,
      aliquota
    ) VALUES (
      v_item.produto_id,
      v_item.nota_id,
      'ipi',
      v_credito_ipi,
      v_credito_ipi,
      v_item.data_emissao,
      v_periodo,
      'disponivel',
      v_item.cst_ipi,
      v_item.cfop,
      v_item.aliquota_ipi
    );
  END IF;
  
  -- Retornar resumo dos créditos gerados
  v_result := jsonb_build_object(
    'icms', v_credito_icms,
    'pis', v_credito_pis,
    'cofins', v_credito_cofins,
    'ipi', v_credito_ipi,
    'total', v_credito_icms + v_credito_pis + v_credito_cofins + v_credito_ipi
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ADICIONAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_itens_nf_validacao ON fabrica_itens_nf(validado_fiscalmente);
CREATE INDEX IF NOT EXISTS idx_creditos_periodo ON fabrica_creditos_tributarios(periodo_apuracao, tipo_credito);
CREATE INDEX IF NOT EXISTS idx_creditos_status ON fabrica_creditos_tributarios(status);

-- 7. COMENTÁRIOS EXPLICATIVOS
COMMENT ON COLUMN fabrica_itens_nf.custo_unitario_entrada IS 'Custo unitário calculado: (Valor Produto + IPI + ST + Frete + Seguro - Descontos) / Qtd';
COMMENT ON COLUMN fabrica_itens_nf.custo_total_entrada IS 'Custo total de entrada do item (base para movimentação de estoque)';
COMMENT ON COLUMN fabrica_itens_nf.validado_fiscalmente IS 'Indica se os dados fiscais foram validados pelo usuário antes da entrada no estoque';
COMMENT ON TABLE fabrica_validacoes_fiscais IS 'Histórico de validações fiscais realizadas nos itens de NF (auditoria e compliance)';
COMMENT ON TABLE fabrica_creditos_tributarios IS 'Créditos fiscais gerados automaticamente (ICMS, PIS, COFINS, IPI) para apuração no SPED';