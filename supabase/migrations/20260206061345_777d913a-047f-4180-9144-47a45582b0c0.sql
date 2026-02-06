CREATE OR REPLACE FUNCTION public.importar_clientes(p_clientes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente JSONB;
  v_inseridos INTEGER := 0;
  v_atualizados INTEGER := 0;
  v_erros INTEGER := 0;
  v_codigo VARCHAR;
  v_is_insert BOOLEAN;
BEGIN
  FOR v_cliente IN SELECT * FROM jsonb_array_elements(p_clientes)
  LOOP
    BEGIN
      v_codigo := COALESCE(v_cliente->>'id_cli', v_cliente->>'codigo');
      
      -- Check if record exists
      SELECT NOT EXISTS(
        SELECT 1 FROM public.clientes 
        WHERE codigo = v_codigo 
          AND empresa_id = COALESCE((v_cliente->>'Empresa_Cli')::INTEGER, 1)
      ) INTO v_is_insert;

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
        status_bloqueio,
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
        COALESCE(v_cliente->>'Bloqueio_cli', v_cliente->>'status_bloqueio'),
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
        nome_abreviado = COALESCE(EXCLUDED.nome_abreviado, clientes.nome_abreviado),
        cnpj = COALESCE(EXCLUDED.cnpj, clientes.cnpj),
        inscricao_estadual = COALESCE(EXCLUDED.inscricao_estadual, clientes.inscricao_estadual),
        tipo_cliente = EXCLUDED.tipo_cliente,
        email = COALESCE(EXCLUDED.email, clientes.email),
        telefone = COALESCE(EXCLUDED.telefone, clientes.telefone),
        celular = COALESCE(EXCLUDED.celular, clientes.celular),
        fax = COALESCE(EXCLUDED.fax, clientes.fax),
        comprador = COALESCE(EXCLUDED.comprador, clientes.comprador),
        endereco = COALESCE(EXCLUDED.endereco, clientes.endereco),
        bairro = COALESCE(EXCLUDED.bairro, clientes.bairro),
        cidade = COALESCE(EXCLUDED.cidade, clientes.cidade),
        uf = COALESCE(EXCLUDED.uf, clientes.uf),
        cep = COALESCE(EXCLUDED.cep, clientes.cep),
        endereco_cobranca = COALESCE(EXCLUDED.endereco_cobranca, clientes.endereco_cobranca),
        bairro_cobranca = COALESCE(EXCLUDED.bairro_cobranca, clientes.bairro_cobranca),
        cidade_cobranca = COALESCE(EXCLUDED.cidade_cobranca, clientes.cidade_cobranca),
        uf_cobranca = COALESCE(EXCLUDED.uf_cobranca, clientes.uf_cobranca),
        cep_cobranca = COALESCE(EXCLUDED.cep_cobranca, clientes.cep_cobranca),
        limite_credito = EXCLUDED.limite_credito,
        classificacao = EXCLUDED.classificacao,
        conceito = COALESCE(EXCLUDED.conceito, clientes.conceito),
        status_bloqueio = COALESCE(EXCLUDED.status_bloqueio, clientes.status_bloqueio),
        rota = COALESCE(EXCLUDED.rota, clientes.rota),
        portador = COALESCE(EXCLUDED.portador, clientes.portador),
        ramo_atividade = COALESCE(EXCLUDED.ramo_atividade, clientes.ramo_atividade),
        convenio = EXCLUDED.convenio,
        data_cadastro = COALESCE(EXCLUDED.data_cadastro, clientes.data_cadastro),
        data_ultima_compra = COALESCE(EXCLUDED.data_ultima_compra, clientes.data_ultima_compra),
        valor_ultima_compra = COALESCE(EXCLUDED.valor_ultima_compra, clientes.valor_ultima_compra),
        data_maior_compra = COALESCE(EXCLUDED.data_maior_compra, clientes.data_maior_compra),
        valor_maior_compra = COALESCE(EXCLUDED.valor_maior_compra, clientes.valor_maior_compra),
        observacoes = COALESCE(EXCLUDED.observacoes, clientes.observacoes),
        contrato = EXCLUDED.contrato,
        responsavel = COALESCE(EXCLUDED.responsavel, clientes.responsavel),
        sincronizado_em = NOW(),
        updated_at = NOW();
      
      IF v_is_insert THEN
        v_inseridos := v_inseridos + 1;
      ELSE
        v_atualizados := v_atualizados + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      RAISE WARNING 'Erro ao importar cliente %: %', v_codigo, SQLERRM;
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