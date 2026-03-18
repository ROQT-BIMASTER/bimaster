
-- Fix: Create text overload for atualizar_perfil_credito_cliente
-- The trigger passes text type but function expects varchar
CREATE OR REPLACE FUNCTION public.atualizar_perfil_credito_cliente(p_cliente_codigo text)
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
  SELECT cliente_nome INTO v_cliente_nome
  FROM contas_receber
  WHERE cliente_codigo = p_cliente_codigo
  LIMIT 1;
  
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
  
  IF v_total_titulos > 0 THEN
    v_pontualidade := (v_titulos_em_dia::DECIMAL / v_total_titulos::DECIMAL) * 100;
  ELSE
    v_pontualidade := 100;
  END IF;
  
  v_score_novo := calcular_score_cliente(p_cliente_codigo);
  
  IF v_score_novo >= 800 THEN v_classificacao := 'excelente';
  ELSIF v_score_novo >= 650 THEN v_classificacao := 'bom';
  ELSIF v_score_novo >= 500 THEN v_classificacao := 'regular';
  ELSIF v_score_novo >= 350 THEN v_classificacao := 'ruim';
  ELSE v_classificacao := 'critico';
  END IF;
  
  IF v_pontualidade >= 90 THEN v_comportamento := 'pagador_pontual';
  ELSIF v_pontualidade >= 70 THEN v_comportamento := 'bom_pagador';
  ELSIF v_pontualidade >= 50 THEN v_comportamento := 'regular';
  ELSIF v_pontualidade >= 30 THEN v_comportamento := 'pagador_atrasado';
  ELSE v_comportamento := 'mau_pagador';
  END IF;
  
  SELECT score_atual INTO v_score_anterior
  FROM clientes_perfil_credito
  WHERE cliente_codigo = p_cliente_codigo;
  
  IF v_score_anterior IS NOT NULL THEN
    IF v_score_novo > v_score_anterior + 50 THEN v_tendencia := 'melhorando';
    ELSIF v_score_novo < v_score_anterior - 50 THEN v_tendencia := 'piorando';
    ELSE v_tendencia := 'estavel';
    END IF;
  ELSE
    v_tendencia := 'novo';
  END IF;
  
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

-- Also fix calcular_score_cliente to accept text
CREATE OR REPLACE FUNCTION public.calcular_score_cliente(p_cliente_codigo text)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_score INTEGER := 500;
  v_total_titulos INTEGER;
  v_titulos_em_dia INTEGER;
  v_titulos_atrasados INTEGER;
  v_maior_atraso INTEGER;
  v_dme INTEGER;
  v_valor_em_aberto DECIMAL;
  v_total_compras DECIMAL;
  v_pontualidade DECIMAL;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) <= 0 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) > 0 THEN 1 ELSE 0 END), 0),
    COALESCE(MAX(CASE WHEN COALESCE(dias_atraso, 0) > 0 THEN dias_atraso ELSE 0 END), 0),
    COALESCE(AVG(CASE WHEN status = 'recebido' AND COALESCE(dias_atraso, 0) > 0 THEN dias_atraso ELSE NULL END), 0)::INTEGER,
    COALESCE(SUM(CASE WHEN status IN ('vencido', 'pendente') THEN valor_aberto ELSE 0 END), 0),
    COALESCE(SUM(valor_original), 0)
  INTO v_total_titulos, v_titulos_em_dia, v_titulos_atrasados, v_maior_atraso, v_dme, v_valor_em_aberto, v_total_compras
  FROM contas_receber
  WHERE cliente_codigo = p_cliente_codigo;

  IF v_total_titulos = 0 THEN
    RETURN 500;
  END IF;

  v_pontualidade := (v_titulos_em_dia::DECIMAL / v_total_titulos::DECIMAL) * 100;

  -- Pontualidade (peso 40%)
  v_score := v_score + ((v_pontualidade - 50) * 4)::INTEGER;

  -- Atraso máximo (peso 20%)
  IF v_maior_atraso > 180 THEN v_score := v_score - 200;
  ELSIF v_maior_atraso > 90 THEN v_score := v_score - 150;
  ELSIF v_maior_atraso > 60 THEN v_score := v_score - 100;
  ELSIF v_maior_atraso > 30 THEN v_score := v_score - 50;
  ELSIF v_maior_atraso > 15 THEN v_score := v_score - 25;
  ELSIF v_maior_atraso = 0 THEN v_score := v_score + 100;
  END IF;

  -- DME (peso 15%)
  IF v_dme > 60 THEN v_score := v_score - 100;
  ELSIF v_dme > 30 THEN v_score := v_score - 50;
  ELSIF v_dme > 15 THEN v_score := v_score - 25;
  ELSIF v_dme <= 5 THEN v_score := v_score + 50;
  END IF;

  -- Volume (peso 10%)
  IF v_total_titulos > 50 THEN v_score := v_score + 50;
  ELSIF v_total_titulos > 20 THEN v_score := v_score + 25;
  ELSIF v_total_titulos > 10 THEN v_score := v_score + 10;
  END IF;

  -- Exposição (peso 15%)
  IF v_total_compras > 0 THEN
    IF (v_valor_em_aberto / v_total_compras) > 0.5 THEN v_score := v_score - 75;
    ELSIF (v_valor_em_aberto / v_total_compras) > 0.3 THEN v_score := v_score - 40;
    ELSIF (v_valor_em_aberto / v_total_compras) < 0.1 THEN v_score := v_score + 50;
    END IF;
  END IF;

  v_score := GREATEST(0, LEAST(1000, v_score));
  
  RETURN v_score;
END;
$$;
