-- Tabela de configuração da empresa
CREATE TABLE IF NOT EXISTS fabrica_empresa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social varchar(255) NOT NULL,
  cnpj varchar(18) NOT NULL,
  inscricao_estadual varchar(20),
  uf varchar(2) NOT NULL,
  regime_tributario varchar(50) NOT NULL CHECK (regime_tributario IN ('lucro_real', 'lucro_presumido', 'simples_nacional')),
  regime_apuracao_icms varchar(50) CHECK (regime_apuracao_icms IN ('normal', 'simplificado')),
  regime_apuracao_pis_cofins varchar(50) CHECK (regime_apuracao_pis_cofins IN ('cumulativo', 'nao_cumulativo')),
  contribuinte_ipi boolean DEFAULT false,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de cadastro de NCM
CREATE TABLE IF NOT EXISTS fabrica_ncm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(10) NOT NULL UNIQUE,
  descricao text NOT NULL,
  unidade_padrao varchar(10),
  ex varchar(10),
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Tabela de regras fiscais por NCM + UF
CREATE TABLE IF NOT EXISTS fabrica_regras_fiscais_ncm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncm_id uuid NOT NULL REFERENCES fabrica_ncm(id) ON DELETE CASCADE,
  uf_origem varchar(2) NOT NULL,
  uf_destino varchar(2) NOT NULL,
  
  -- ICMS
  cst_icms_entrada varchar(3),
  cst_icms_saida varchar(3),
  aliquota_icms numeric(5,2),
  aliquota_fcp numeric(5,2),
  tem_st boolean DEFAULT false,
  mva numeric(5,2),
  reducao_base_icms numeric(5,2),
  
  -- CFOP
  cfop_entrada varchar(10),
  cfop_saida varchar(10),
  
  -- IPI
  cst_ipi varchar(3),
  aliquota_ipi numeric(5,2),
  
  -- PIS/COFINS
  cst_pis varchar(3),
  cst_cofins varchar(3),
  aliquota_pis numeric(5,2),
  aliquota_cofins numeric(5,2),
  
  -- Observações
  comentario text,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  UNIQUE(ncm_id, uf_origem, uf_destino)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_regras_fiscais_ncm_lookup ON fabrica_regras_fiscais_ncm(ncm_id, uf_origem, uf_destino) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_ncm_codigo ON fabrica_ncm(codigo) WHERE ativo = true;

-- RLS Policies
ALTER TABLE fabrica_empresa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_ncm ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_regras_fiscais_ncm ENABLE ROW LEVEL SECURITY;

-- Políticas para empresa_config
CREATE POLICY "Admins gerenciam config empresa" ON fabrica_empresa_config
  FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários com permissão fabrica veem config" ON fabrica_empresa_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- Políticas para NCM
CREATE POLICY "Admins gerenciam NCM" ON fabrica_ncm
  FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários com permissão fabrica veem NCM" ON fabrica_ncm
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- Políticas para regras fiscais NCM
CREATE POLICY "Admins gerenciam regras fiscais NCM" ON fabrica_regras_fiscais_ncm
  FOR ALL USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários com permissão fabrica veem regras fiscais NCM" ON fabrica_regras_fiscais_ncm
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- Função para buscar regra fiscal automaticamente
CREATE OR REPLACE FUNCTION buscar_regra_fiscal_ncm(
  p_ncm_codigo varchar,
  p_uf_origem varchar,
  p_uf_destino varchar
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'cst_icms_entrada', rfn.cst_icms_entrada,
    'cst_icms_saida', rfn.cst_icms_saida,
    'aliquota_icms', rfn.aliquota_icms,
    'aliquota_fcp', rfn.aliquota_fcp,
    'tem_st', rfn.tem_st,
    'mva', rfn.mva,
    'reducao_base_icms', rfn.reducao_base_icms,
    'cfop_entrada', rfn.cfop_entrada,
    'cfop_saida', rfn.cfop_saida,
    'cst_ipi', rfn.cst_ipi,
    'aliquota_ipi', rfn.aliquota_ipi,
    'cst_pis', rfn.cst_pis,
    'cst_cofins', rfn.cst_cofins,
    'aliquota_pis', rfn.aliquota_pis,
    'aliquota_cofins', rfn.aliquota_cofins,
    'comentario', rfn.comentario
  ) INTO v_result
  FROM fabrica_regras_fiscais_ncm rfn
  JOIN fabrica_ncm ncm ON ncm.id = rfn.ncm_id
  WHERE ncm.codigo = p_ncm_codigo
    AND rfn.uf_origem = p_uf_origem
    AND rfn.uf_destino = p_uf_destino
    AND rfn.ativo = true
    AND (rfn.vigencia_inicio IS NULL OR rfn.vigencia_inicio <= CURRENT_DATE)
    AND (rfn.vigencia_fim IS NULL OR rfn.vigencia_fim >= CURRENT_DATE)
  LIMIT 1;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;