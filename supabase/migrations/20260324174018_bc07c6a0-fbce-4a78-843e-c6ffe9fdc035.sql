-- Fix all remaining functions missing SET search_path

-- 1. calcular_status_conta_pagar
CREATE OR REPLACE FUNCTION public.calcular_status_conta_pagar()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'cancelado' THEN RETURN NEW; END IF;
  NEW.status := CASE 
    WHEN NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN 'pago'
    WHEN NEW.valor_pago > 0 AND NEW.valor_aberto > 0 THEN 'parcial'
    WHEN NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN 'vencido'
    ELSE 'pendente'
  END;
  RETURN NEW;
END;
$function$;

-- 2. fn_criar_titulo_receber
CREATE OR REPLACE FUNCTION public.fn_criar_titulo_receber(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_titulo_id UUID; v_num SMALLINT; v_valor NUMERIC(15,2); v_venc DATE; i SMALLINT; result JSONB;
BEGIN
  v_num := COALESCE((payload->>'num_parcelas')::SMALLINT, 1);
  v_valor := ROUND((payload->>'valor_original')::NUMERIC / v_num, 2);
  v_venc := (payload->>'data_vencimento')::DATE;
  INSERT INTO contas_receber (empresa_id, cliente_id, numero_documento, descricao, data_emissao, data_vencimento, data_competencia, valor_original, valor_desconto, valor_juros, valor_liquido, status, categoria, plano_conta_id, centro_custo_id, conta_bancaria_id, num_parcelas, observacoes, tags, codigo_integracao, data_inc, hora_inc, user_inc, enviado_erp)
  VALUES ((payload->>'empresa_id')::UUID, (payload->>'cliente_id')::UUID, payload->>'numero_documento', payload->>'descricao', COALESCE((payload->>'data_emissao')::DATE, CURRENT_DATE), v_venc, (payload->>'data_competencia')::DATE, (payload->>'valor_original')::NUMERIC, COALESCE((payload->>'valor_desconto')::NUMERIC,0), COALESCE((payload->>'valor_juros')::NUMERIC,0), COALESCE((payload->>'valor_liquido')::NUMERIC, (payload->>'valor_original')::NUMERIC - COALESCE((payload->>'valor_desconto')::NUMERIC,0) + COALESCE((payload->>'valor_juros')::NUMERIC,0)), 'pendente', payload->>'categoria', (payload->>'plano_conta_id')::UUID, (payload->>'centro_custo_id')::UUID, (payload->>'conta_bancaria_id')::UUID, v_num, payload->>'observacoes', ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'tags','[]'::jsonb))), payload->>'codigo_integracao', CURRENT_DATE, CURRENT_TIME, payload->>'user_inc', COALESCE((payload->>'enviado_erp')::BOOLEAN, FALSE))
  RETURNING id INTO v_titulo_id;
  FOR i IN 1..v_num LOOP
    INSERT INTO parcelas_receber (empresa_id, conta_receber_id, numero_parcela, descricao, data_vencimento, valor_original, status, data_inc, hora_inc, user_inc)
    VALUES ((payload->>'empresa_id')::UUID, v_titulo_id, i, payload->>'descricao' || ' — Parcela ' || i || '/' || v_num, v_venc + ((i-1) * INTERVAL '1 month'), v_valor, 'pendente', CURRENT_DATE, CURRENT_TIME, payload->>'user_inc');
  END LOOP;
  SELECT jsonb_build_object('titulo', row_to_json(t)::JSONB, 'parcelas', (SELECT jsonb_agg(row_to_json(p)::JSONB ORDER BY p.numero_parcela) FROM parcelas_receber p WHERE p.conta_receber_id = v_titulo_id))
  INTO result FROM contas_receber t WHERE t.id = v_titulo_id;
  RETURN result;
END;
$function$;

-- 3. fn_enfileirar_erp
CREATE OR REPLACE FUNCTION public.fn_enfileirar_erp(p_empresa_id uuid, p_tabela character varying, p_registro_id uuid, p_payload jsonb DEFAULT NULL::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_id UUID;
BEGIN
  UPDATE erp_sync_log SET payload_enviado=COALESCE(p_payload,payload_enviado), tentativas=0, proximo_envio=NOW(), sync_status='pendente'
  WHERE empresa_id=p_empresa_id AND tabela_origem=p_tabela AND registro_id=p_registro_id AND sync_status IN ('pendente','erro')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    INSERT INTO erp_sync_log (empresa_id,tabela_origem,registro_id,payload_enviado,sync_status) VALUES (p_empresa_id,p_tabela,p_registro_id,p_payload,'pendente') RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$function$;

-- 4. fn_pesquisar_titulos
CREATE OR REPLACE FUNCTION public.fn_pesquisar_titulos(p_empresa_id uuid, p_tipo character varying DEFAULT NULL, p_status character varying DEFAULT NULL, p_data_ini date DEFAULT NULL, p_data_fim date DEFAULT NULL, p_limite integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object('titulos',COALESCE(jsonb_agg(t ORDER BY t.data_vencimento),'[]'::JSONB),'total',COUNT(*) OVER())
  INTO result FROM (
    SELECT id,'pagar'::TEXT AS tipo,numero_documento,fornecedor_nome AS descricao,data_vencimento,data_emissao,valor_original,valor_aberto AS valor_liquido,valor_pago AS valor_liquidado,valor_aberto AS saldo,status,total_parcelas AS num_parcelas,codigo_integracao,importado_api AS enviado_erp
    FROM contas_pagar WHERE empresa_id=p_empresa_id AND (p_tipo IS NULL OR p_tipo='pagar') AND (p_status IS NULL OR status=p_status) AND (p_data_ini IS NULL OR data_vencimento>=p_data_ini) AND (p_data_fim IS NULL OR data_vencimento<=p_data_fim)
    UNION ALL
    SELECT id,'receber'::TEXT,numero_documento,descricao,data_vencimento,data_emissao,valor_original,valor_liquido,valor_recebido,(valor_liquido-valor_recebido),status,num_parcelas,codigo_integracao,enviado_erp
    FROM contas_receber WHERE empresa_id=p_empresa_id AND inativo=FALSE AND (p_tipo IS NULL OR p_tipo='receber') AND (p_status IS NULL OR status=p_status) AND (p_data_ini IS NULL OR data_vencimento>=p_data_ini) AND (p_data_fim IS NULL OR data_vencimento<=p_data_fim)
  ) t LIMIT p_limite OFFSET p_offset;
  RETURN COALESCE(result,'{"titulos":[],"total":0}'::JSONB);
END;
$function$;

-- 5. fn_registrar_recebimento
CREATE OR REPLACE FUNCTION public.fn_registrar_recebimento(payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE v_parcela RECORD; v_rec_id UUID; result JSONB;
BEGIN
  SELECT * INTO v_parcela FROM parcelas_receber WHERE id = (payload->>'parcela_id')::UUID;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parcela não encontrada: %', payload->>'parcela_id'; END IF;
  IF v_parcela.status = 'recebido' THEN RAISE EXCEPTION 'Parcela já recebida.'; END IF;
  IF v_parcela.status = 'cancelado' THEN RAISE EXCEPTION 'Parcela cancelada.'; END IF;
  INSERT INTO recebimentos (empresa_id, parcela_receber_id, conta_bancaria_id, data_recebimento, valor_recebido, valor_desconto, valor_juros, forma_recebimento, numero_documento, autenticacao, observacoes, status, data_inc, hora_inc, user_inc)
  VALUES (COALESCE((payload->>'empresa_id')::UUID, v_parcela.empresa_id), v_parcela.id, COALESCE((payload->>'conta_bancaria_id')::UUID, v_parcela.conta_bancaria_id), COALESCE((payload->>'data_recebimento')::DATE, CURRENT_DATE), COALESCE((payload->>'valor_recebido')::NUMERIC, v_parcela.valor_original), COALESCE((payload->>'valor_desconto')::NUMERIC,0), COALESCE((payload->>'valor_juros')::NUMERIC,0), COALESCE(payload->>'forma_recebimento','transferencia'), payload->>'numero_documento', payload->>'autenticacao', payload->>'observacoes', 'confirmado', CURRENT_DATE, CURRENT_TIME, payload->>'user_inc')
  RETURNING id INTO v_rec_id;
  UPDATE parcelas_receber SET status='recebido', data_recebimento=COALESCE((payload->>'data_recebimento')::DATE,CURRENT_DATE), valor_recebido=COALESCE((payload->>'valor_recebido')::NUMERIC,valor_original), valor_desconto=COALESCE((payload->>'valor_desconto')::NUMERIC,0), valor_juros=COALESCE((payload->>'valor_juros')::NUMERIC,0), recebimento_id=v_rec_id WHERE id=v_parcela.id;
  SELECT jsonb_build_object('recebimento_id',v_rec_id,'parcela_id',v_parcela.id,'titulo_id',v_parcela.conta_receber_id,'status','confirmado','valor_recebido',COALESCE((payload->>'valor_recebido')::NUMERIC,v_parcela.valor_original),'data_recebimento',COALESCE((payload->>'data_recebimento')::DATE,CURRENT_DATE)) INTO result;
  RETURN result;
END;
$function$;

-- 6. fn_resumo_financeiro
CREATE OR REPLACE FUNCTION public.fn_resumo_financeiro(p_empresa_id uuid, p_mes smallint DEFAULT NULL, p_ano smallint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_mes SMALLINT := COALESCE(p_mes, EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT);
  v_ano SMALLINT := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT);
  v_ini DATE := make_date(v_ano,v_mes,1);
  v_fim DATE := (make_date(v_ano,v_mes,1) + INTERVAL '1 month - 1 day')::DATE;
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_a_pagar_mes', COALESCE((SELECT SUM(valor_aberto) FROM contas_pagar WHERE empresa_id=p_empresa_id AND data_vencimento BETWEEN v_ini AND v_fim AND status IN ('pendente','vencido','parcial')),0),
    'pagamentos_mes', COALESCE((SELECT SUM(pag.valor) FROM pagamentos pag JOIN parcelas par ON par.id=pag.parcela_id JOIN contas_pagar cp ON cp.id=par.conta_pagar_id WHERE cp.empresa_id=p_empresa_id AND pag.data_pagamento BETWEEN v_ini AND v_fim),0),
    'titulos_vencidos_pagar', COALESCE((SELECT COUNT(*) FROM contas_pagar WHERE empresa_id=p_empresa_id AND status IN ('pendente','parcial') AND data_vencimento < CURRENT_DATE),0),
    'total_a_receber_mes', COALESCE((SELECT SUM(valor_liquido) FROM contas_receber WHERE empresa_id=p_empresa_id AND inativo=FALSE AND data_vencimento BETWEEN v_ini AND v_fim AND status IN ('pendente','vencido','parcial')),0),
    'recebimentos_mes', COALESCE((SELECT SUM(valor_recebido) FROM recebimentos WHERE empresa_id=p_empresa_id AND data_recebimento BETWEEN v_ini AND v_fim AND status='confirmado'),0),
    'titulos_vencidos_receber', COALESCE((SELECT COUNT(*) FROM contas_receber WHERE empresa_id=p_empresa_id AND inativo=FALSE AND status IN ('pendente','parcial') AND data_vencimento < CURRENT_DATE),0),
    'saldo_contas', COALESCE((SELECT SUM(saldo_atual) FROM contas_bancarias WHERE empresa_id=p_empresa_id AND inativo=FALSE),0),
    'pendentes_erp', COALESCE((SELECT COUNT(*) FROM erp_sync_log WHERE empresa_id=p_empresa_id AND sync_status='pendente'),0),
    'mes',v_mes,'ano',v_ano,'data_calculo',CURRENT_DATE
  ) INTO result;
  RETURN result;
END;
$function$;

-- 7. fn_set_audit_on_update
CREATE OR REPLACE FUNCTION public.fn_set_audit_on_update()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;

-- 8. fn_sync_titulo_receber_status
CREATE OR REPLACE FUNCTION public.fn_sync_titulo_receber_status()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_titulo_id UUID := COALESCE(NEW.conta_receber_id, OLD.conta_receber_id);
  v_total INT; v_recebidas INT; v_canceladas INT; v_novo_status VARCHAR(20);
BEGIN
  SELECT COUNT(*) INTO v_total FROM parcelas_receber WHERE conta_receber_id = v_titulo_id;
  SELECT COUNT(*) INTO v_recebidas FROM parcelas_receber WHERE conta_receber_id = v_titulo_id AND status = 'recebido';
  SELECT COUNT(*) INTO v_canceladas FROM parcelas_receber WHERE conta_receber_id = v_titulo_id AND status = 'cancelado';
  IF v_recebidas = v_total THEN v_novo_status := 'recebido';
  ELSIF v_canceladas = v_total THEN v_novo_status := 'cancelado';
  ELSIF v_recebidas > 0 THEN v_novo_status := 'parcial';
  ELSIF EXISTS(SELECT 1 FROM parcelas_receber WHERE conta_receber_id = v_titulo_id AND status = 'pendente' AND data_vencimento < CURRENT_DATE)
    THEN v_novo_status := 'vencido';
  ELSE v_novo_status := 'pendente'; END IF;
  UPDATE contas_receber SET status = v_novo_status,
    valor_recebido = (SELECT COALESCE(SUM(valor_recebido),0) FROM parcelas_receber WHERE conta_receber_id = v_titulo_id AND status = 'recebido')
  WHERE id = v_titulo_id;
  RETURN NEW;
END;
$function$;

-- 9. generate_tarefa_codigo
CREATE OR REPLACE FUNCTION public.generate_tarefa_codigo()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_prefix TEXT;
  v_count INT;
BEGIN
  v_prefix := COALESCE(NEW.tipo, 'GEN');
  SELECT COUNT(*) + 1 INTO v_count FROM tarefas WHERE tipo = NEW.tipo;
  NEW.codigo := UPPER(LEFT(v_prefix, 3)) || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN NEW;
END;
$function$;

-- 10. handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 11. trg_hash_api_key
CREATE OR REPLACE FUNCTION public.trg_hash_api_key()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.api_key IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.api_key IS DISTINCT FROM OLD.api_key) THEN
    NEW.api_key_hash := encode(extensions.digest(NEW.api_key, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$function$;