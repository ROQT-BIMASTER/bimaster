-- Corrigir warnings de segurança da migration anterior

-- 1. HABILITAR RLS na nova tabela
ALTER TABLE fabrica_validacoes_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fabrica_validacoes_fiscais
CREATE POLICY "Usuários do módulo fábrica podem visualizar validações"
  ON fabrica_validacoes_fiscais FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários do módulo fábrica podem inserir validações"
  ON fabrica_validacoes_fiscais FOR INSERT
  WITH CHECK (
    usuario_tem_permissao_modulo(auth.uid(), 'fabrica')
    AND validado_por = auth.uid()
  );

-- 2. RECRIAR FUNÇÕES COM search_path CORRETO
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
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION calcular_custo_entrada(
  p_valor_produto DECIMAL,
  p_valor_ipi DECIMAL DEFAULT 0,
  p_valor_icms_st DECIMAL DEFAULT 0,
  p_valor_frete DECIMAL DEFAULT 0,
  p_valor_seguro DECIMAL DEFAULT 0,
  p_outras_despesas DECIMAL DEFAULT 0,
  p_valor_desconto DECIMAL DEFAULT 0
) RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_custo_entrada DECIMAL;
BEGIN
  v_custo_entrada := p_valor_produto 
                   + COALESCE(p_valor_ipi, 0)
                   + COALESCE(p_valor_icms_st, 0)
                   + COALESCE(p_valor_frete, 0)
                   + COALESCE(p_valor_seguro, 0)
                   + COALESCE(p_outras_despesas, 0)
                   - COALESCE(p_valor_desconto, 0);
  
  RETURN v_custo_entrada;
END;
$$;

CREATE OR REPLACE FUNCTION gerar_creditos_tributarios(
  p_item_nf_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_credito_icms DECIMAL := 0;
  v_credito_pis DECIMAL := 0;
  v_credito_cofins DECIMAL := 0;
  v_credito_ipi DECIMAL := 0;
  v_periodo TEXT;
  v_result JSONB;
BEGIN
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
  
  v_periodo := TO_CHAR(v_item.data_emissao, 'YYYY-MM');
  
  IF v_item.gera_credito_icms AND v_item.valor_icms > 0 THEN
    v_credito_icms := v_item.valor_icms;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id, nota_id, tipo_credito, valor_credito, saldo_credito,
      data_credito, periodo_apuracao, status, cst, cfop, aliquota, base_calculo
    ) VALUES (
      v_item.produto_id, v_item.nota_id, 'icms_proprio', v_credito_icms, v_credito_icms,
      v_item.data_emissao, v_periodo, 'disponivel', v_item.cst_icms,
      v_item.cfop, v_item.aliquota_icms, v_item.base_icms
    );
  END IF;
  
  IF v_item.gera_credito_pis AND v_item.valor_pis > 0 THEN
    v_credito_pis := v_item.valor_pis;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id, nota_id, tipo_credito, valor_credito, saldo_credito,
      data_credito, periodo_apuracao, status, cst, cfop, aliquota, base_calculo
    ) VALUES (
      v_item.produto_id, v_item.nota_id, 'pis', v_credito_pis, v_credito_pis,
      v_item.data_emissao, v_periodo, 'disponivel', v_item.cst_pis,
      v_item.cfop, v_item.aliquota_pis, v_item.base_pis
    );
  END IF;
  
  IF v_item.gera_credito_cofins AND v_item.valor_cofins > 0 THEN
    v_credito_cofins := v_item.valor_cofins;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id, nota_id, tipo_credito, valor_credito, saldo_credito,
      data_credito, periodo_apuracao, status, cst, cfop, aliquota, base_calculo
    ) VALUES (
      v_item.produto_id, v_item.nota_id, 'cofins', v_credito_cofins, v_credito_cofins,
      v_item.data_emissao, v_periodo, 'disponivel', v_item.cst_cofins,
      v_item.cfop, v_item.aliquota_cofins, v_item.base_cofins
    );
  END IF;
  
  IF v_item.gera_credito_ipi AND v_item.valor_ipi > 0 THEN
    v_credito_ipi := v_item.valor_ipi;
    
    INSERT INTO fabrica_creditos_tributarios (
      produto_id, nota_id, tipo_credito, valor_credito, saldo_credito,
      data_credito, periodo_apuracao, status, cst, cfop, aliquota
    ) VALUES (
      v_item.produto_id, v_item.nota_id, 'ipi', v_credito_ipi, v_credito_ipi,
      v_item.data_emissao, v_periodo, 'disponivel', v_item.cst_ipi,
      v_item.cfop, v_item.aliquota_ipi
    );
  END IF;
  
  v_result := jsonb_build_object(
    'icms', v_credito_icms,
    'pis', v_credito_pis,
    'cofins', v_credito_cofins,
    'ipi', v_credito_ipi,
    'total', v_credito_icms + v_credito_pis + v_credito_cofins + v_credito_ipi
  );
  
  RETURN v_result;
END;
$$;