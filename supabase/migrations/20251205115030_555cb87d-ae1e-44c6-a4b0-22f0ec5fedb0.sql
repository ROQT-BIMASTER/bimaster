
-- Tabela de perfil de crédito do cliente
CREATE TABLE public.clientes_perfil_credito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_codigo VARCHAR(50) NOT NULL UNIQUE,
  cliente_nome VARCHAR(255),
  
  -- Limites de crédito
  limite_credito DECIMAL(15,2) DEFAULT 0,
  limite_utilizado DECIMAL(15,2) DEFAULT 0,
  limite_disponivel DECIMAL(15,2) GENERATED ALWAYS AS (limite_credito - limite_utilizado) STORED,
  
  -- Score e análise
  score_atual INTEGER DEFAULT 500 CHECK (score_atual >= 0 AND score_atual <= 1000),
  score_classificacao VARCHAR(20) DEFAULT 'regular',
  historico_scores JSONB DEFAULT '[]'::jsonb,
  
  -- Métricas de pagamento
  dme INTEGER DEFAULT 0, -- Dias Médios de Efetivação
  pontualidade_percentual DECIMAL(5,2) DEFAULT 100,
  total_titulos_historico INTEGER DEFAULT 0,
  titulos_pagos_em_dia INTEGER DEFAULT 0,
  titulos_pagos_em_atraso INTEGER DEFAULT 0,
  maior_atraso_dias INTEGER DEFAULT 0,
  
  -- Valores históricos
  total_compras_historico DECIMAL(15,2) DEFAULT 0,
  total_pagamentos_historico DECIMAL(15,2) DEFAULT 0,
  valor_medio_compra DECIMAL(15,2) DEFAULT 0,
  
  -- Datas importantes
  primeira_compra DATE,
  ultima_compra DATE,
  ultimo_pagamento DATE,
  
  -- Status e alertas
  status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'bloqueado', 'suspenso', 'inativo')),
  motivo_bloqueio TEXT,
  bloqueado_em TIMESTAMP WITH TIME ZONE,
  bloqueado_por UUID,
  
  -- Análise de comportamento
  comportamento_pagamento VARCHAR(30) DEFAULT 'regular',
  meses_maior_atraso JSONB DEFAULT '[]'::jsonb, -- Sazonalidade
  tendencia_score VARCHAR(20) DEFAULT 'estavel',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de histórico de alterações de score
CREATE TABLE public.clientes_score_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_codigo VARCHAR(50) NOT NULL,
  score_anterior INTEGER,
  score_novo INTEGER NOT NULL,
  motivo VARCHAR(100),
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de alertas de crédito
CREATE TABLE public.clientes_alertas_credito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_codigo VARCHAR(50) NOT NULL,
  tipo_alerta VARCHAR(50) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  mensagem TEXT,
  severidade VARCHAR(20) DEFAULT 'warning' CHECK (severidade IN ('info', 'warning', 'critical')),
  dados_alerta JSONB,
  lido BOOLEAN DEFAULT false,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  resolvido_por UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_clientes_perfil_codigo ON clientes_perfil_credito(cliente_codigo);
CREATE INDEX idx_clientes_perfil_status ON clientes_perfil_credito(status);
CREATE INDEX idx_clientes_perfil_score ON clientes_perfil_credito(score_atual);
CREATE INDEX idx_clientes_score_hist_codigo ON clientes_score_historico(cliente_codigo);
CREATE INDEX idx_clientes_alertas_codigo ON clientes_alertas_credito(cliente_codigo);
CREATE INDEX idx_clientes_alertas_resolvido ON clientes_alertas_credito(resolvido);

-- Enable RLS
ALTER TABLE clientes_perfil_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_score_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_alertas_credito ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Financeiro pode ver perfis de crédito"
ON clientes_perfil_credito FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Financeiro pode gerenciar perfis de crédito"
ON clientes_perfil_credito FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Financeiro pode ver histórico de score"
ON clientes_score_historico FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Financeiro pode inserir histórico de score"
ON clientes_score_historico FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Financeiro pode ver alertas de crédito"
ON clientes_alertas_credito FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor') OR
  usuario_tem_permissao_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Financeiro pode gerenciar alertas"
ON clientes_alertas_credito FOR ALL
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'supervisor')
);

-- Função para calcular score do cliente baseado em histórico
CREATE OR REPLACE FUNCTION public.calcular_score_cliente(p_cliente_codigo VARCHAR)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score INTEGER := 500; -- Score base
  v_total_titulos INTEGER;
  v_titulos_em_dia INTEGER;
  v_titulos_atrasados INTEGER;
  v_valor_total DECIMAL;
  v_valor_em_aberto DECIMAL;
  v_maior_atraso INTEGER;
  v_dme INTEGER;
  v_pontualidade DECIMAL;
BEGIN
  -- Buscar métricas do cliente
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND dias_atraso <= 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND dias_atraso > 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(valor_original), 0),
    COALESCE(SUM(CASE WHEN status IN ('vencido', 'pendente') THEN valor_aberto ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN dias_atraso > 0 THEN dias_atraso ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN status = 'recebido' AND dias_atraso > 0 THEN dias_atraso ELSE NULL END), 0)
  INTO v_total_titulos, v_titulos_em_dia, v_titulos_atrasados, v_valor_total, v_valor_em_aberto, v_maior_atraso, v_dme
  FROM contas_receber
  WHERE cliente_codigo = p_cliente_codigo;
  
  IF v_total_titulos = 0 THEN
    RETURN 500; -- Cliente novo, score neutro
  END IF;
  
  -- Calcular pontualidade
  v_pontualidade := (v_titulos_em_dia::DECIMAL / v_total_titulos::DECIMAL) * 100;
  
  -- Ajustar score baseado em pontualidade (peso 40%)
  v_score := v_score + ((v_pontualidade - 50) * 4)::INTEGER;
  
  -- Ajustar baseado em maior atraso (peso 25%)
  IF v_maior_atraso <= 7 THEN
    v_score := v_score + 50;
  ELSIF v_maior_atraso <= 15 THEN
    v_score := v_score + 25;
  ELSIF v_maior_atraso <= 30 THEN
    v_score := v_score + 0;
  ELSIF v_maior_atraso <= 60 THEN
    v_score := v_score - 50;
  ELSIF v_maior_atraso <= 90 THEN
    v_score := v_score - 100;
  ELSE
    v_score := v_score - 200;
  END IF;
  
  -- Ajustar baseado em DME (peso 20%)
  IF v_dme <= 5 THEN
    v_score := v_score + 50;
  ELSIF v_dme <= 10 THEN
    v_score := v_score + 25;
  ELSIF v_dme <= 15 THEN
    v_score := v_score + 0;
  ELSIF v_dme <= 30 THEN
    v_score := v_score - 25;
  ELSE
    v_score := v_score - 75;
  END IF;
  
  -- Ajustar baseado em valor em aberto vs histórico (peso 15%)
  IF v_valor_total > 0 THEN
    IF (v_valor_em_aberto / v_valor_total) < 0.05 THEN
      v_score := v_score + 50;
    ELSIF (v_valor_em_aberto / v_valor_total) < 0.15 THEN
      v_score := v_score + 25;
    ELSIF (v_valor_em_aberto / v_valor_total) < 0.30 THEN
      v_score := v_score + 0;
    ELSE
      v_score := v_score - 50;
    END IF;
  END IF;
  
  -- Garantir que score fica entre 0 e 1000
  v_score := GREATEST(0, LEAST(1000, v_score));
  
  RETURN v_score;
END;
$$;

-- Função para atualizar perfil completo do cliente
CREATE OR REPLACE FUNCTION public.atualizar_perfil_credito_cliente(p_cliente_codigo VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_perfil_id UUID;
  v_cliente_nome VARCHAR;
  v_total_titulos INTEGER;
  v_titulos_em_dia INTEGER;
  v_titulos_atrasados INTEGER;
  v_total_compras DECIMAL;
  v_valor_em_aberto DECIMAL;
  v_maior_atraso INTEGER;
  v_dme INTEGER;
  v_pontualidade DECIMAL;
  v_primeira_compra DATE;
  v_ultima_compra DATE;
  v_ultimo_pagamento DATE;
  v_score_novo INTEGER;
  v_score_anterior INTEGER;
  v_classificacao VARCHAR;
  v_comportamento VARCHAR;
  v_tendencia VARCHAR;
BEGIN
  -- Buscar nome do cliente
  SELECT cliente_nome INTO v_cliente_nome
  FROM contas_receber
  WHERE cliente_codigo = p_cliente_codigo
  LIMIT 1;
  
  -- Calcular métricas
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) <= 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) > 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(valor_original), 0),
    COALESCE(SUM(CASE WHEN status IN ('vencido', 'pendente') THEN valor_aberto ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN COALESCE(dias_atraso, 0) > 0 THEN dias_atraso ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) > 0 THEN dias_atraso ELSE NULL END), 0)::INTEGER,
    MIN(data_emissao),
    MAX(data_emissao),
    MAX(CASE WHEN status = 'recebido' THEN data_recebimento ELSE NULL END)
  INTO v_total_titulos, v_titulos_em_dia, v_titulos_atrasados, v_total_compras, 
       v_valor_em_aberto, v_maior_atraso, v_dme, v_primeira_compra, v_ultima_compra, v_ultimo_pagamento
  FROM contas_receber
  WHERE cliente_codigo = p_cliente_codigo;
  
  -- Calcular pontualidade
  IF v_total_titulos > 0 THEN
    v_pontualidade := (v_titulos_em_dia::DECIMAL / v_total_titulos::DECIMAL) * 100;
  ELSE
    v_pontualidade := 100;
  END IF;
  
  -- Calcular score
  v_score_novo := calcular_score_cliente(p_cliente_codigo);
  
  -- Determinar classificação
  IF v_score_novo >= 800 THEN
    v_classificacao := 'excelente';
  ELSIF v_score_novo >= 650 THEN
    v_classificacao := 'bom';
  ELSIF v_score_novo >= 500 THEN
    v_classificacao := 'regular';
  ELSIF v_score_novo >= 350 THEN
    v_classificacao := 'ruim';
  ELSE
    v_classificacao := 'critico';
  END IF;
  
  -- Determinar comportamento
  IF v_pontualidade >= 90 THEN
    v_comportamento := 'pagador_pontual';
  ELSIF v_pontualidade >= 70 THEN
    v_comportamento := 'bom_pagador';
  ELSIF v_pontualidade >= 50 THEN
    v_comportamento := 'regular';
  ELSIF v_pontualidade >= 30 THEN
    v_comportamento := 'pagador_atrasado';
  ELSE
    v_comportamento := 'mau_pagador';
  END IF;
  
  -- Buscar score anterior para calcular tendência
  SELECT score_atual INTO v_score_anterior
  FROM clientes_perfil_credito
  WHERE cliente_codigo = p_cliente_codigo;
  
  IF v_score_anterior IS NOT NULL THEN
    IF v_score_novo > v_score_anterior + 50 THEN
      v_tendencia := 'melhorando';
    ELSIF v_score_novo < v_score_anterior - 50 THEN
      v_tendencia := 'piorando';
    ELSE
      v_tendencia := 'estavel';
    END IF;
  ELSE
    v_tendencia := 'novo';
  END IF;
  
  -- Upsert do perfil
  INSERT INTO clientes_perfil_credito (
    cliente_codigo, cliente_nome, limite_utilizado,
    score_atual, score_classificacao,
    dme, pontualidade_percentual, total_titulos_historico,
    titulos_pagos_em_dia, titulos_pagos_em_atraso, maior_atraso_dias,
    total_compras_historico, valor_medio_compra,
    primeira_compra, ultima_compra, ultimo_pagamento,
    comportamento_pagamento, tendencia_score, updated_at
  ) VALUES (
    p_cliente_codigo, v_cliente_nome, v_valor_em_aberto,
    v_score_novo, v_classificacao,
    v_dme, v_pontualidade, v_total_titulos,
    v_titulos_em_dia, v_titulos_atrasados, v_maior_atraso,
    v_total_compras, CASE WHEN v_total_titulos > 0 THEN v_total_compras / v_total_titulos ELSE 0 END,
    v_primeira_compra, v_ultima_compra, v_ultimo_pagamento,
    v_comportamento, v_tendencia, now()
  )
  ON CONFLICT (cliente_codigo) DO UPDATE SET
    cliente_nome = EXCLUDED.cliente_nome,
    limite_utilizado = EXCLUDED.limite_utilizado,
    score_atual = EXCLUDED.score_atual,
    score_classificacao = EXCLUDED.score_classificacao,
    dme = EXCLUDED.dme,
    pontualidade_percentual = EXCLUDED.pontualidade_percentual,
    total_titulos_historico = EXCLUDED.total_titulos_historico,
    titulos_pagos_em_dia = EXCLUDED.titulos_pagos_em_dia,
    titulos_pagos_em_atraso = EXCLUDED.titulos_pagos_em_atraso,
    maior_atraso_dias = EXCLUDED.maior_atraso_dias,
    total_compras_historico = EXCLUDED.total_compras_historico,
    valor_medio_compra = EXCLUDED.valor_medio_compra,
    primeira_compra = EXCLUDED.primeira_compra,
    ultima_compra = EXCLUDED.ultima_compra,
    ultimo_pagamento = EXCLUDED.ultimo_pagamento,
    comportamento_pagamento = EXCLUDED.comportamento_pagamento,
    tendencia_score = EXCLUDED.tendencia_score,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_perfil_id;
  
  -- Registrar mudança de score se houve alteração significativa
  IF v_score_anterior IS NOT NULL AND ABS(v_score_novo - v_score_anterior) >= 25 THEN
    INSERT INTO clientes_score_historico (
      cliente_codigo, score_anterior, score_novo, motivo, detalhes
    ) VALUES (
      p_cliente_codigo, v_score_anterior, v_score_novo, 
      'atualização_automatica',
      jsonb_build_object(
        'pontualidade', v_pontualidade,
        'dme', v_dme,
        'maior_atraso', v_maior_atraso,
        'valor_em_aberto', v_valor_em_aberto
      )
    );
    
    -- Criar alerta se score caiu muito
    IF v_score_novo < v_score_anterior - 100 THEN
      INSERT INTO clientes_alertas_credito (
        cliente_codigo, tipo_alerta, titulo, mensagem, severidade, dados_alerta
      ) VALUES (
        p_cliente_codigo, 
        'queda_score',
        'Score de crédito em queda',
        'O score do cliente caiu de ' || v_score_anterior || ' para ' || v_score_novo,
        CASE WHEN v_score_novo < 350 THEN 'critical' ELSE 'warning' END,
        jsonb_build_object('score_anterior', v_score_anterior, 'score_novo', v_score_novo)
      );
    END IF;
  END IF;
  
  RETURN v_perfil_id;
END;
$$;

-- Trigger para atualização automática
CREATE OR REPLACE FUNCTION public.trigger_atualizar_perfil_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Atualizar perfil de crédito quando contas_receber muda
  PERFORM atualizar_perfil_credito_cliente(NEW.cliente_codigo);
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_atualizar_perfil_credito
AFTER INSERT OR UPDATE ON contas_receber
FOR EACH ROW
EXECUTE FUNCTION trigger_atualizar_perfil_credito();
