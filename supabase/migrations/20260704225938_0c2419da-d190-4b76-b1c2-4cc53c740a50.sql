
CREATE OR REPLACE FUNCTION public.fn_transform_fornecedores_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_upd1 integer := 0; v_upd2 integer := 0; v_ins integer := 0;
BEGIN
  UPDATE public.fornecedores f SET
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, f.prazo_pagamento_padrao),
    erp_code = COALESCE(f.erp_code, s.rubysp_fornecedor_id::text),
    fonte_erp = 'RESULT', erp_sync_status='synced', erp_synced_at=now(), updated_at=now()
  FROM public.erp_fornecedores_rubysp s
  WHERE f.codigo_externo = s.rubysp_fornecedor_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  UPDATE public.fornecedores f SET
    codigo_externo = s.rubysp_fornecedor_id::text,
    erp_code = COALESCE(f.erp_code, s.rubysp_fornecedor_id::text),
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, f.prazo_pagamento_padrao),
    fonte_erp = 'RESULT', erp_sync_status='synced', erp_synced_at=now(), updated_at=now()
  FROM public.erp_fornecedores_rubysp s
  WHERE f.codigo_externo IS NULL AND s.cnpj_digits <> '' AND f.cnpj_digits = s.cnpj_digits;
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  INSERT INTO public.fornecedores (
    nome, razao_social, cnpj, codigo_externo, erp_code, fonte_erp, prazo_pagamento_padrao,
    email, telefone, cidade, estado, cep, bairro, inscricao_estadual,
    status, importado_api, erp_sync_status, erp_synced_at
  )
  SELECT DISTINCT ON (COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id))
    LEFT(COALESCE(NULLIF(s.nome,''), 'FORNECEDOR '||s.rubysp_fornecedor_id), 100),
    LEFT(COALESCE(NULLIF(s.nome,''), 'FORNECEDOR '||s.rubysp_fornecedor_id), 200),
    LEFT(COALESCE(NULLIF(s.cnpj,''), 'SEM-CNPJ-'||s.rubysp_fornecedor_id), 18),
    s.rubysp_fornecedor_id::text, s.rubysp_fornecedor_id::text, 'RESULT', s.prazo_pagamento,
    LEFT(s.email,100), LEFT(s.telefone,20), LEFT(s.cidade,40), LEFT(s.uf,2),
    LEFT(s.cep,9), LEFT(s.bairro,60), LEFT(s.inscricao_estadual,20),
    'ativo', false, 'synced', now()
  FROM public.erp_fornecedores_rubysp s
  WHERE NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.codigo_externo = s.rubysp_fornecedor_id::text)
    AND NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE s.cnpj_digits <> '' AND f.cnpj_digits = s.cnpj_digits)
  ORDER BY COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id), s.rubysp_fornecedor_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_transform_fornecedores_rubysp() TO service_role;
