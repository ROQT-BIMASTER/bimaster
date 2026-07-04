
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS cnpj_digits text
  GENERATED ALWAYS AS (regexp_replace(coalesce(cnpj,''),'[^0-9]','','g')) STORED;

CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj_digits ON public.fornecedores (cnpj_digits);
CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_externo ON public.fornecedores (codigo_externo);

CREATE OR REPLACE FUNCTION public.fn_transform_fornecedores_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_upd1 integer := 0; v_upd2 integer := 0; v_ins integer := 0;
BEGIN
  -- 1) já vinculados por codigo_externo: atualiza prazo + carimbo (não toca banco/PIX/razão)
  UPDATE public.fornecedores f SET
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, f.prazo_pagamento_padrao),
    erp_code               = COALESCE(f.erp_code, s.rubysp_fornecedor_id::text),
    fonte_erp              = 'RESULT',
    erp_sync_status        = 'synced', erp_synced_at = now(), updated_at = now()
  FROM public.erp_fornecedores_rubysp s
  WHERE f.codigo_externo = s.rubysp_fornecedor_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  -- 2) sem codigo_externo, casa por CNPJ canônico -> vincula
  UPDATE public.fornecedores f SET
    codigo_externo         = s.rubysp_fornecedor_id::text,
    erp_code               = COALESCE(f.erp_code, s.rubysp_fornecedor_id::text),
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, f.prazo_pagamento_padrao),
    fonte_erp              = 'RESULT',
    erp_sync_status        = 'synced', erp_synced_at = now(), updated_at = now()
  FROM public.erp_fornecedores_rubysp s
  WHERE f.codigo_externo IS NULL
    AND s.cnpj_digits <> '' AND f.cnpj_digits = s.cnpj_digits;
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  -- 3) novos -> insere (cnpj NOT NULL: guard). DISTINCT ON evita dup por CNPJ repetido no Result.
  INSERT INTO public.fornecedores (
    nome, razao_social, cnpj, codigo_externo, erp_code, fonte_erp, prazo_pagamento_padrao,
    email, telefone, cidade, estado, cep, bairro, inscricao_estadual,
    status, importado_api, erp_sync_status, erp_synced_at
  )
  SELECT DISTINCT ON (COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id))
    COALESCE(NULLIF(s.nome,''), 'FORNECEDOR '||s.rubysp_fornecedor_id),
    COALESCE(NULLIF(s.nome,''), 'FORNECEDOR '||s.rubysp_fornecedor_id),
    COALESCE(NULLIF(s.cnpj,''), 'SEM-CNPJ-'||s.rubysp_fornecedor_id),
    s.rubysp_fornecedor_id::text, s.rubysp_fornecedor_id::text, 'RESULT', s.prazo_pagamento,
    s.email, s.telefone, s.cidade, s.uf, s.cep, s.bairro, s.inscricao_estadual,
    'ativo', false, 'synced', now()
  FROM public.erp_fornecedores_rubysp s
  WHERE NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE f.codigo_externo = s.rubysp_fornecedor_id::text)
    AND NOT EXISTS (SELECT 1 FROM public.fornecedores f WHERE s.cnpj_digits <> '' AND f.cnpj_digits = s.cnpj_digits)
  ORDER BY COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id), s.rubysp_fornecedor_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_transform_fornecedores_rubysp() TO service_role;
