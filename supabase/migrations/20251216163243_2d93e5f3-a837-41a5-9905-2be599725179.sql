-- =====================================================
-- 1. TABELA DE CLIENTES (Master Data)
-- =====================================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL,
  empresa_id INTEGER DEFAULT 1,
  nome VARCHAR(255) NOT NULL,
  nome_abreviado VARCHAR(100),
  cnpj VARCHAR(18),
  inscricao_estadual VARCHAR(50),
  tipo_cliente INTEGER DEFAULT 0,
  
  -- Contato
  email VARCHAR(255),
  telefone VARCHAR(20),
  celular VARCHAR(20),
  fax VARCHAR(20),
  comprador VARCHAR(100),
  
  -- Endereço Principal
  endereco VARCHAR(255),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  cep VARCHAR(10),
  
  -- Endereço Cobrança
  endereco_cobranca VARCHAR(255),
  bairro_cobranca VARCHAR(100),
  cidade_cobranca VARCHAR(100),
  uf_cobranca VARCHAR(2),
  cep_cobranca VARCHAR(10),
  
  -- Financeiro
  limite_credito DECIMAL(15,2) DEFAULT 0,
  classificacao INTEGER DEFAULT 0,
  conceito VARCHAR(20),
  status_bloqueio VARCHAR(20) DEFAULT 'ativo',
  
  -- Comercial
  rota VARCHAR(20),
  portador VARCHAR(20),
  ramo_atividade INTEGER,
  convenio INTEGER DEFAULT 0,
  
  -- Histórico
  data_cadastro TIMESTAMPTZ,
  data_ultima_compra TIMESTAMPTZ,
  valor_ultima_compra DECIMAL(15,2),
  data_maior_compra TIMESTAMPTZ,
  valor_maior_compra DECIMAL(15,2),
  
  -- Controle
  observacoes TEXT,
  contrato INTEGER DEFAULT 0,
  responsavel VARCHAR(100),
  sincronizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint única
  CONSTRAINT clientes_codigo_empresa_unique UNIQUE (codigo, empresa_id)
);

-- =====================================================
-- 2. ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX idx_clientes_cnpj ON public.clientes(cnpj);
CREATE INDEX idx_clientes_email ON public.clientes(email);
CREATE INDEX idx_clientes_telefone ON public.clientes(telefone);
CREATE INDEX idx_clientes_celular ON public.clientes(celular);
CREATE INDEX idx_clientes_rota ON public.clientes(rota);
CREATE INDEX idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX idx_clientes_status ON public.clientes(status_bloqueio);
CREATE INDEX idx_clientes_nome ON public.clientes(nome);

-- =====================================================
-- 3. FUNÇÃO PARA BUSCAR DADOS DE CONTATO DO CLIENTE
-- =====================================================
CREATE OR REPLACE FUNCTION public.buscar_dados_cliente_cobranca(p_cliente_codigo VARCHAR)
RETURNS TABLE (
  cliente_nome VARCHAR,
  cliente_email VARCHAR,
  cliente_telefone VARCHAR,
  cliente_celular VARCHAR,
  cliente_endereco VARCHAR,
  cliente_cidade VARCHAR,
  cliente_uf VARCHAR,
  limite_credito DECIMAL,
  status_bloqueio VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.nome::VARCHAR,
    COALESCE(c.email, cr.cliente_nome)::VARCHAR as cliente_email,
    COALESCE(c.telefone, '')::VARCHAR,
    COALESCE(c.celular, '')::VARCHAR,
    COALESCE(c.endereco, '')::VARCHAR,
    COALESCE(c.cidade, '')::VARCHAR,
    COALESCE(c.uf, '')::VARCHAR,
    COALESCE(c.limite_credito, 0)::DECIMAL,
    COALESCE(c.status_bloqueio, 'ativo')::VARCHAR
  FROM public.clientes c
  LEFT JOIN public.contas_receber cr ON cr.cliente_codigo = c.codigo
  WHERE c.codigo = p_cliente_codigo
  LIMIT 1;
END;
$$;

-- =====================================================
-- 4. ADICIONAR COLUNAS DE CONTATO NA FILA_COBRANCAS
-- =====================================================
ALTER TABLE public.fila_cobrancas 
ADD COLUMN IF NOT EXISTS cliente_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS cliente_telefone VARCHAR(20),
ADD COLUMN IF NOT EXISTS cliente_celular VARCHAR(20);

-- =====================================================
-- 5. TRIGGER PARA AUTO-PREENCHER DADOS DE CONTATO
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_preencher_dados_cliente_fila()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente RECORD;
BEGIN
  -- Buscar dados do cliente
  SELECT 
    c.nome,
    c.email,
    c.telefone,
    c.celular
  INTO v_cliente
  FROM public.clientes c
  WHERE c.codigo = NEW.cliente_codigo
  LIMIT 1;
  
  -- Preencher dados se encontrou o cliente
  IF FOUND THEN
    NEW.cliente_nome := COALESCE(NEW.cliente_nome, v_cliente.nome);
    NEW.cliente_email := COALESCE(NEW.cliente_email, v_cliente.email);
    NEW.cliente_telefone := COALESCE(NEW.cliente_telefone, v_cliente.telefone);
    NEW.cliente_celular := COALESCE(NEW.cliente_celular, v_cliente.celular);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS tr_preencher_dados_cliente_fila ON public.fila_cobrancas;
CREATE TRIGGER tr_preencher_dados_cliente_fila
  BEFORE INSERT ON public.fila_cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_preencher_dados_cliente_fila();

-- =====================================================
-- 6. VIEW CONSOLIDADA PARA COBRANÇA
-- =====================================================
CREATE OR REPLACE VIEW public.vw_clientes_cobranca AS
SELECT 
  c.id as cliente_id,
  c.codigo as cliente_codigo,
  c.nome as cliente_nome,
  c.cnpj,
  c.email,
  c.telefone,
  c.celular,
  c.endereco,
  c.cidade,
  c.uf,
  c.limite_credito,
  c.status_bloqueio,
  c.rota,
  -- Perfil de crédito
  pf.score_atual,
  pf.score_classificacao,
  pf.dme,
  pf.pontualidade_percentual,
  pf.comportamento_pagamento,
  -- Títulos em aberto
  COALESCE(titulos.total_titulos, 0) as total_titulos_abertos,
  COALESCE(titulos.valor_total_aberto, 0) as valor_total_aberto,
  COALESCE(titulos.maior_atraso, 0) as maior_atraso_dias,
  COALESCE(titulos.titulo_mais_antigo, CURRENT_DATE) as vencimento_mais_antigo
FROM public.clientes c
LEFT JOIN public.clientes_perfil_credito pf ON pf.cliente_codigo = c.codigo
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_titulos,
    SUM(valor_aberto) as valor_total_aberto,
    MAX(dias_atraso) as maior_atraso,
    MIN(data_vencimento) as titulo_mais_antigo
  FROM public.contas_receber cr
  WHERE cr.cliente_codigo = c.codigo
    AND cr.status IN ('vencido', 'pendente')
    AND cr.valor_aberto > 0
) titulos ON true;

-- =====================================================
-- 7. FUNÇÃO PARA IMPORTAR CLIENTES EM MASSA
-- =====================================================
CREATE OR REPLACE FUNCTION public.importar_clientes(p_clientes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente JSONB;
  v_inseridos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_erros INTEGER := 0;
  v_codigo VARCHAR;
BEGIN
  FOR v_cliente IN SELECT * FROM jsonb_array_elements(p_clientes)
  LOOP
    BEGIN
      v_codigo := COALESCE(v_cliente->>'id_cli', v_cliente->>'codigo');
      
      INSERT INTO public.clientes (
        codigo,
        empresa_id,
        nome,
        nome_abreviado,
        cnpj,
        inscricao_estadual,
        tipo_cliente,
        email,
        telefone,
        celular,
        fax,
        comprador,
        endereco,
        bairro,
        cidade,
        uf,
        cep,
        endereco_cobranca,
        bairro_cobranca,
        cidade_cobranca,
        uf_cobranca,
        cep_cobranca,
        limite_credito,
        classificacao,
        conceito,
        rota,
        portador,
        ramo_atividade,
        convenio,
        data_cadastro,
        data_ultima_compra,
        valor_ultima_compra,
        data_maior_compra,
        valor_maior_compra,
        observacoes,
        contrato,
        responsavel,
        sincronizado_em
      ) VALUES (
        v_codigo,
        COALESCE((v_cliente->>'Empresa_Cli')::INTEGER, 1),
        COALESCE(v_cliente->>'Nome_cli', v_cliente->>'nome'),
        v_cliente->>'Abrev_cli',
        COALESCE(v_cliente->>'CNPJ_cli', v_cliente->>'cnpj'),
        COALESCE(v_cliente->>'Ins_cli', v_cliente->>'inscricao_estadual'),
        COALESCE((v_cliente->>'Tipo_cli')::INTEGER, 0),
        COALESCE(v_cliente->>'Email_cli', v_cliente->>'email'),
        COALESCE(v_cliente->>'Telefone_cli', v_cliente->>'telefone'),
        COALESCE(v_cliente->>'Celular_cli', v_cliente->>'celular'),
        v_cliente->>'Fax_cli',
        v_cliente->>'Comprador_cli',
        COALESCE(v_cliente->>'Endereco_cli', v_cliente->>'endereco'),
        COALESCE(v_cliente->>'Bairro_cli', v_cliente->>'bairro'),
        COALESCE(v_cliente->>'Cidade_cli', v_cliente->>'cidade'),
        COALESCE(v_cliente->>'UF_cli', v_cliente->>'uf'),
        COALESCE(v_cliente->>'Cep_cli', v_cliente->>'cep'),
        v_cliente->>'EndCob_cli',
        v_cliente->>'BairCob_cli',
        v_cliente->>'CidCob_cli',
        v_cliente->>'UFCob_cli',
        v_cliente->>'CepCob_cli',
        COALESCE((v_cliente->>'Limite_cli')::DECIMAL, 0),
        COALESCE((v_cliente->>'Classificacao_cli')::INTEGER, 0),
        v_cliente->>'Conceito_cli',
        COALESCE(v_cliente->>'Rota_cli', v_cliente->>'rota'),
        COALESCE(v_cliente->>'Portador_cli', v_cliente->>'portador'),
        (v_cliente->>'ramo_cli')::INTEGER,
        COALESCE((v_cliente->>'Convenio_cli')::INTEGER, 0),
        (v_cliente->>'DtCad_cli')::TIMESTAMPTZ,
        (v_cliente->>'DataUCompra_cli')::TIMESTAMPTZ,
        (v_cliente->>'ValorUCompra_cli')::DECIMAL,
        (v_cliente->>'DataMCompra_cli')::TIMESTAMPTZ,
        (v_cliente->>'ValorMCompra_cli')::DECIMAL,
        v_cliente->>'obs_cli',
        COALESCE((v_cliente->>'Contrato_cli')::INTEGER, 0),
        v_cliente->>'Responsavel_cli',
        NOW()
      )
      ON CONFLICT (codigo, empresa_id) DO UPDATE SET
        nome = EXCLUDED.nome,
        nome_abreviado = EXCLUDED.nome_abreviado,
        cnpj = EXCLUDED.cnpj,
        inscricao_estadual = EXCLUDED.inscricao_estadual,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone,
        celular = EXCLUDED.celular,
        endereco = EXCLUDED.endereco,
        bairro = EXCLUDED.bairro,
        cidade = EXCLUDED.cidade,
        uf = EXCLUDED.uf,
        cep = EXCLUDED.cep,
        limite_credito = EXCLUDED.limite_credito,
        rota = EXCLUDED.rota,
        data_ultima_compra = EXCLUDED.data_ultima_compra,
        valor_ultima_compra = EXCLUDED.valor_ultima_compra,
        sincronizado_em = NOW(),
        updated_at = NOW();
      
      IF FOUND THEN
        v_inseridos := v_inseridos + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'inseridos', v_inseridos,
    'atualizados', v_atualizados,
    'erros', v_erros,
    'total', jsonb_array_length(p_clientes)
  );
END;
$$;

-- =====================================================
-- 8. RLS POLICIES
-- =====================================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor: acesso total
CREATE POLICY "Admin e supervisor acessam todos clientes"
  ON public.clientes FOR ALL
  USING (public.is_admin_or_supervisor(auth.uid()));

-- Usuários autenticados podem ler
CREATE POLICY "Usuários autenticados podem ler clientes"
  ON public.clientes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =====================================================
-- 9. TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION public.trigger_clientes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_clientes_updated_at();