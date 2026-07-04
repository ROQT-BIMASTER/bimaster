
-- 1) Staging cru dos fornecedores do Result
CREATE TABLE IF NOT EXISTS public.erp_fornecedores_rubysp (
  rubysp_fornecedor_id  bigint PRIMARY KEY,
  empresa_par           integer,
  nome                  text,
  cnpj                  text,
  cnpj_digits           text GENERATED ALWAYS AS (regexp_replace(coalesce(cnpj,''),'[^0-9]','','g')) STORED,
  prazo_pagamento       integer,
  email                 text,
  telefone              text,
  contato               text,
  inscricao_estadual    text,
  endereco              text,
  bairro                text,
  cidade                text,
  uf                    text,
  cep                   text,
  banco                 text,
  agencia               text,
  conta                 text,
  raw                   jsonb,
  sincronizado_em       timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_forn_rubysp_cnpj_digits
  ON public.erp_fornecedores_rubysp (cnpj_digits);

GRANT SELECT ON public.erp_fornecedores_rubysp TO authenticated;
GRANT ALL    ON public.erp_fornecedores_rubysp TO service_role;

ALTER TABLE public.erp_fornecedores_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_forn_rubysp_sel" ON public.erp_fornecedores_rubysp;
CREATE POLICY "erp_forn_rubysp_sel" ON public.erp_fornecedores_rubysp
  FOR SELECT TO authenticated USING (true);

-- 2) Função de transform staging -> fabrica_fornecedores (idempotente, master misto)
CREATE OR REPLACE FUNCTION public.fn_transform_fornecedores_rubysp()
RETURNS TABLE (inseridos integer, atualizados integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_upd1 integer := 0;
  v_upd2 integer := 0;
  v_ins  integer := 0;
BEGIN
  -- 1) já vinculados por erp_code: atualiza prazo + carimbo (não toca banco/PIX/razão)
  UPDATE public.fabrica_fornecedores ff SET
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, ff.prazo_pagamento_padrao),
    cnpj                   = COALESCE(ff.cnpj, s.cnpj),
    erp_sync_status        = 'synced',
    erp_synced_at          = now(),
    updated_at             = now()
  FROM public.erp_fornecedores_rubysp s
  WHERE ff.erp_code = s.rubysp_fornecedor_id::text;
  GET DIAGNOSTICS v_upd1 = ROW_COUNT;

  -- 2) sem erp_code ainda: casa por CNPJ canônico e vincula
  UPDATE public.fabrica_fornecedores ff SET
    erp_code               = s.rubysp_fornecedor_id::text,
    prazo_pagamento_padrao = COALESCE(s.prazo_pagamento, ff.prazo_pagamento_padrao),
    erp_sync_status        = 'synced',
    erp_synced_at          = now(),
    updated_at             = now()
  FROM public.erp_fornecedores_rubysp s
  WHERE ff.erp_code IS NULL
    AND s.cnpj_digits <> ''
    AND ff.cnpj_digits = s.cnpj_digits;
  GET DIAGNOSTICS v_upd2 = ROW_COUNT;

  -- 3) inexistente no Huugs: insere novo (DISTINCT ON evita duplicar por CNPJ)
  INSERT INTO public.fabrica_fornecedores (
    razao_social, cnpj, erp_code, prazo_pagamento_padrao,
    email, telefone, contato, inscricao_estadual,
    endereco, bairro, cidade, uf, cep,
    ativo, pendente_complemento, erp_sync_status, erp_synced_at
  )
  SELECT DISTINCT ON (COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id))
    COALESCE(NULLIF(s.nome,''), 'FORNECEDOR '||s.rubysp_fornecedor_id),
    s.cnpj, s.rubysp_fornecedor_id::text, s.prazo_pagamento,
    s.email, s.telefone, s.contato, s.inscricao_estadual,
    s.endereco, s.bairro, s.cidade, s.uf, s.cep,
    true, true, 'synced', now()
  FROM public.erp_fornecedores_rubysp s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fabrica_fornecedores ff
    WHERE ff.erp_code = s.rubysp_fornecedor_id::text
  )
    AND NOT EXISTS (
      SELECT 1 FROM public.fabrica_fornecedores ff
      WHERE s.cnpj_digits <> '' AND ff.cnpj_digits = s.cnpj_digits
    )
  ORDER BY COALESCE(NULLIF(s.cnpj_digits,''), 'id:'||s.rubysp_fornecedor_id), s.rubysp_fornecedor_id;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN QUERY SELECT v_ins, (v_upd1 + v_upd2);
END $$;

REVOKE ALL ON FUNCTION public.fn_transform_fornecedores_rubysp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_transform_fornecedores_rubysp() TO service_role;
