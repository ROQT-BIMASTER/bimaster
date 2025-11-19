-- ============================================
-- FUNÇÕES PARA INTERPRETAÇÃO DE CST
-- ============================================

-- Função para determinar se CST de ICMS gera crédito
CREATE OR REPLACE FUNCTION public.icms_gera_credito(p_cst text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_cst
    -- CST 00: Tributado integralmente → Gera crédito integral
    WHEN '00' THEN RETURN true;
    
    -- CST 10: Tributado com ST → Sem crédito
    WHEN '10' THEN RETURN false;
    
    -- CST 20: Com redução de BC → Gera crédito proporcional
    WHEN '20' THEN RETURN true;
    
    -- CST 30: Isento/Não tributado com ST → Sem crédito
    WHEN '30' THEN RETURN false;
    
    -- CST 40, 41, 50: Isento/Não tributado/Suspensão → Sem crédito
    WHEN '40', '41', '50' THEN RETURN false;
    
    -- CST 51: Diferimento → Sem crédito
    WHEN '51' THEN RETURN false;
    
    -- CST 60: ST retido anteriormente → Sem crédito
    WHEN '60' THEN RETURN false;
    
    -- CST 70: ST com redução de BC → Sem crédito
    WHEN '70' THEN RETURN false;
    
    -- CST 90: Outros → Validar ICMS próprio (padrão: gerar crédito se tiver valor)
    WHEN '90' THEN RETURN true;
    
    -- Outros casos: sem crédito por segurança
    ELSE RETURN false;
  END CASE;
END;
$$;

-- Função para determinar tipo de crédito ICMS
CREATE OR REPLACE FUNCTION public.icms_tipo_credito(p_cst text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_cst
    WHEN '00' THEN RETURN 'integral';
    WHEN '20' THEN RETURN 'proporcional';
    WHEN '90' THEN RETURN 'parcial';
    WHEN '10', '30', '40', '41', '50', '51', '60', '70' THEN RETURN 'sem_credito';
    ELSE RETURN 'sem_credito';
  END CASE;
END;
$$;

-- Função para determinar se CST de PIS/COFINS gera crédito
CREATE OR REPLACE FUNCTION public.pis_cofins_gera_credito(p_cst text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_cst
    -- CST 01, 02: Operação tributável com alíquota básica/diferenciada → Gera crédito
    WHEN '01', '02' THEN RETURN true;
    
    -- CST 03: Operação tributável monofásica → Sem crédito
    WHEN '03' THEN RETURN false;
    
    -- CST 04, 05, 06: Operação tributável com suspensão/alíquota zero/isenta → Sem crédito
    WHEN '04', '05', '06' THEN RETURN false;
    
    -- CST 07, 08, 09: Outras operações sem crédito
    WHEN '07', '08', '09' THEN RETURN false;
    
    -- CST 50-56: Operação com direito a crédito (regime não-cumulativo)
    WHEN '50', '51', '52', '53', '54', '55', '56' THEN RETURN true;
    
    -- CST 60: ST → Sem crédito
    WHEN '60' THEN RETURN false;
    
    -- CST 70-74: Operação de aquisição sem direito a crédito
    WHEN '70', '71', '72', '73', '74' THEN RETURN false;
    
    -- Outros casos: sem crédito por segurança
    ELSE RETURN false;
  END CASE;
END;
$$;

-- Função para determinar tipo de crédito PIS/COFINS
CREATE OR REPLACE FUNCTION public.pis_cofins_tipo_credito(p_cst text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_cst
    WHEN '01', '02' THEN RETURN 'integral';
    WHEN '50', '51', '52', '53', '54', '55', '56' THEN RETURN 'nao_cumulativo';
    WHEN '03' THEN RETURN 'monofasico_sem_credito';
    WHEN '60' THEN RETURN 'st_sem_credito';
    WHEN '04', '05', '06', '07', '08', '09', '70', '71', '72', '73', '74' THEN RETURN 'sem_credito';
    ELSE RETURN 'sem_credito';
  END CASE;
END;
$$;

-- ============================================
-- TABELA DE REFERÊNCIA CST
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_cst_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_imposto varchar(20) NOT NULL, -- ICMS, PIS, COFINS
  codigo_cst varchar(10) NOT NULL,
  descricao text NOT NULL,
  gera_credito boolean NOT NULL DEFAULT false,
  tipo_credito varchar(50),
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(tipo_imposto, codigo_cst)
);

-- ============================================
-- POPULAR TABELA DE REFERÊNCIA - ICMS
-- ============================================

INSERT INTO fabrica_cst_referencia (tipo_imposto, codigo_cst, descricao, gera_credito, tipo_credito, observacoes)
VALUES
  ('ICMS', '00', 'Tributada integralmente', true, 'integral', 'Permite crédito integral do ICMS destacado'),
  ('ICMS', '10', 'Tributada com ST', false, 'sem_credito', 'ICMS-ST substitui crédito normal'),
  ('ICMS', '20', 'Com redução de BC', true, 'proporcional', 'Crédito proporcional à base reduzida'),
  ('ICMS', '30', 'Isenta/Não tributada com ST', false, 'sem_credito', 'Operação com ST sem crédito'),
  ('ICMS', '40', 'Isenta', false, 'sem_credito', 'Operação isenta não gera crédito'),
  ('ICMS', '41', 'Não tributada', false, 'sem_credito', 'Operação não tributada'),
  ('ICMS', '50', 'Suspensão', false, 'sem_credito', 'Suspensão de ICMS'),
  ('ICMS', '51', 'Diferimento', false, 'sem_credito', 'ICMS diferido para etapa posterior'),
  ('ICMS', '60', 'ST retido anteriormente', false, 'sem_credito', 'ST já recolhido por substituto'),
  ('ICMS', '70', 'ST com redução de BC', false, 'sem_credito', 'ST com BC reduzida, sem crédito'),
  ('ICMS', '90', 'Outros', true, 'parcial', 'Validar valor de ICMS próprio para crédito')
ON CONFLICT (tipo_imposto, codigo_cst) DO NOTHING;

-- ============================================
-- POPULAR TABELA DE REFERÊNCIA - PIS/COFINS
-- ============================================

INSERT INTO fabrica_cst_referencia (tipo_imposto, codigo_cst, descricao, gera_credito, tipo_credito, observacoes)
VALUES
  ('PIS', '01', 'Operação tributável - alíquota básica', true, 'integral', 'Regime não-cumulativo'),
  ('PIS', '02', 'Operação tributável - alíquota diferenciada', true, 'integral', 'Regime não-cumulativo'),
  ('PIS', '03', 'Operação tributável - monofásica', false, 'monofasico_sem_credito', 'Sem direito a crédito'),
  ('PIS', '04', 'Operação tributável - alíquota zero', false, 'sem_credito', 'Alíquota zero'),
  ('PIS', '05', 'Operação tributável - suspensão', false, 'sem_credito', 'Suspensão do tributo'),
  ('PIS', '06', 'Operação tributável - isenta', false, 'sem_credito', 'Isenta de PIS'),
  ('PIS', '07', 'Operação isenta da contribuição', false, 'sem_credito', 'Isenta'),
  ('PIS', '08', 'Operação sem incidência', false, 'sem_credito', 'Sem incidência'),
  ('PIS', '09', 'Operação com suspensão', false, 'sem_credito', 'Suspensão'),
  ('PIS', '50', 'Operação com direito a crédito', true, 'nao_cumulativo', 'Crédito vinculado receita tributada'),
  ('PIS', '51', 'Operação com direito a crédito - aquisição sujeita ST', true, 'nao_cumulativo', 'Crédito presumido'),
  ('PIS', '52', 'Operação com direito a crédito - alíquota diferenciada', true, 'nao_cumulativo', 'Crédito alíquota diferenciada'),
  ('PIS', '53', 'Operação com direito a crédito - presumido', true, 'nao_cumulativo', 'Crédito presumido'),
  ('PIS', '54', 'Operação com direito a crédito - presumido de outras operações', true, 'nao_cumulativo', 'Crédito presumido'),
  ('PIS', '55', 'Operação com direito a crédito - importação', true, 'nao_cumulativo', 'Crédito na importação'),
  ('PIS', '56', 'Operação com direito a crédito - ativo imobilizado', true, 'nao_cumulativo', 'Crédito sobre ativo'),
  ('PIS', '60', 'Crédito presumido - ST', false, 'st_sem_credito', 'Substituição tributária'),
  ('PIS', '70', 'Operação sem direito a crédito', false, 'sem_credito', 'Sem direito a crédito'),
  ('PIS', '71', 'Operação sem direito a crédito - aquisição sujeita ST', false, 'sem_credito', 'ST sem crédito'),
  ('PIS', '72', 'Operação sem direito a crédito - presumido de outras operações', false, 'sem_credito', 'Sem crédito'),
  ('PIS', '73', 'Operação sem direito a crédito - importação', false, 'sem_credito', 'Importação sem crédito'),
  ('PIS', '74', 'Operação sem direito a crédito - ativo imobilizado', false, 'sem_credito', 'Ativo sem crédito')
ON CONFLICT (tipo_imposto, codigo_cst) DO NOTHING;

-- Copiar regras PIS para COFINS (mesmas regras)
INSERT INTO fabrica_cst_referencia (tipo_imposto, codigo_cst, descricao, gera_credito, tipo_credito, observacoes)
SELECT 
  'COFINS' as tipo_imposto,
  codigo_cst,
  REPLACE(descricao, 'PIS', 'COFINS') as descricao,
  gera_credito,
  tipo_credito,
  REPLACE(observacoes, 'PIS', 'COFINS') as observacoes
FROM fabrica_cst_referencia
WHERE tipo_imposto = 'PIS'
ON CONFLICT (tipo_imposto, codigo_cst) DO NOTHING;

-- ============================================
-- FUNÇÃO PARA VALIDAR CRÉDITOS NA NOTA FISCAL
-- ============================================

CREATE OR REPLACE FUNCTION public.validar_creditos_nota_fiscal(p_nota_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_item RECORD;
  v_result jsonb := '[]'::jsonb;
  v_icms_credito boolean;
  v_pis_credito boolean;
  v_cofins_credito boolean;
  v_item_result jsonb;
BEGIN
  FOR v_item IN 
    SELECT 
      id,
      produto_codigo,
      produto_descricao,
      cst_icms,
      cst_pis,
      cst_cofins,
      valor_icms,
      valor_pis,
      valor_cofins,
      tem_icms_st
    FROM fabrica_itens_nf
    WHERE nota_id = p_nota_id
  LOOP
    -- Validar ICMS
    v_icms_credito := public.icms_gera_credito(v_item.cst_icms);
    
    -- Se tem ST, bloquear crédito independente do CST
    IF v_item.tem_icms_st THEN
      v_icms_credito := false;
    END IF;
    
    -- Validar PIS
    v_pis_credito := public.pis_cofins_gera_credito(v_item.cst_pis);
    
    -- Validar COFINS
    v_cofins_credito := public.pis_cofins_gera_credito(v_item.cst_cofins);
    
    -- Construir resultado do item
    v_item_result := jsonb_build_object(
      'item_id', v_item.id,
      'produto_codigo', v_item.produto_codigo,
      'produto_descricao', v_item.produto_descricao,
      'icms', jsonb_build_object(
        'cst', v_item.cst_icms,
        'gera_credito', v_icms_credito,
        'valor', v_item.valor_icms,
        'tipo_credito', public.icms_tipo_credito(v_item.cst_icms),
        'tem_st', v_item.tem_icms_st
      ),
      'pis', jsonb_build_object(
        'cst', v_item.cst_pis,
        'gera_credito', v_pis_credito,
        'valor', v_item.valor_pis,
        'tipo_credito', public.pis_cofins_tipo_credito(v_item.cst_pis)
      ),
      'cofins', jsonb_build_object(
        'cst', v_item.cst_cofins,
        'gera_credito', v_cofins_credito,
        'valor', v_item.valor_cofins,
        'tipo_credito', public.pis_cofins_tipo_credito(v_item.cst_cofins)
      )
    );
    
    v_result := v_result || v_item_result;
  END LOOP;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.icms_gera_credito IS 'Determina se CST de ICMS permite crédito tributário';
COMMENT ON FUNCTION public.pis_cofins_gera_credito IS 'Determina se CST de PIS/COFINS permite crédito tributário';
COMMENT ON FUNCTION public.validar_creditos_nota_fiscal IS 'Valida automaticamente quais itens da nota geram crédito tributário';
COMMENT ON TABLE fabrica_cst_referencia IS 'Tabela de referência com todos os CSTs e suas regras de crédito';