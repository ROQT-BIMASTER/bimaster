-- ===========================================================================
-- 1) CABEÇALHO / RECEBIMENTO DA NF-e DE ENTRADA (espelha dbo.ControleNfeEntrada)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_nfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso        varchar(44) NOT NULL UNIQUE,
  empresa_id          integer,
  modelo              varchar(2),
  serie               integer,
  numero              bigint,
  natureza_operacao   text,
  emitente_cnpj       varchar(18),
  emitente_nome       varchar(120),
  fornecedor_id       uuid,
  data_emissao        timestamptz,
  data_entrada        timestamptz,
  valor_total         numeric(15,2),
  valor_produtos      numeric(15,2),
  valor_frete         numeric(15,2),
  valor_desconto      numeric(15,2),
  xml_raw             text,
  xml_storage_path    text,
  danfe_url           text,
  nsu                 varchar(30),
  status_sefaz        text,
  cancelada           boolean NOT NULL DEFAULT false,
  manifestacao        text CHECK (manifestacao IN ('pendente','ciencia','confirmada','desconhecida','nao_realizada')) DEFAULT 'pendente',
  manifestacao_data   timestamptz,
  origem              text NOT NULL DEFAULT 'xml_upload' CHECK (origem IN ('xml_upload','dfe_sefaz','sync_result','manual')),
  status_processamento text NOT NULL DEFAULT 'importada' CHECK (status_processamento IN ('importada','vinculada','divergente','rejeitada')),
  criado_por          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_empresa      ON public.ap_nfe (empresa_id);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_emitente     ON public.ap_nfe (emitente_cnpj);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_data_emissao ON public.ap_nfe (data_emissao);

-- ===========================================================================
-- 2) ITEM / LINHA FISCAL DA NF-e
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_nfe_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_nfe_id           uuid NOT NULL REFERENCES public.ap_nfe(id) ON DELETE CASCADE,
  item_seq            integer NOT NULL,
  codigo_produto      varchar(60),
  descricao           text,
  ncm                 varchar(8),
  cest                varchar(7),
  cfop                integer,
  unidade             varchar(6),
  quantidade          numeric(15,4),
  valor_unitario      numeric(15,6),
  valor_produto       numeric(15,2),
  valor_contabil      numeric(15,2),
  cst_icms            varchar(3),
  classe_tributaria   varchar(6),
  base_icms           numeric(15,2), aliq_icms numeric(9,4), valor_icms numeric(15,2),
  base_icms_st        numeric(15,2), valor_icms_st numeric(15,2),
  base_ipi            numeric(15,2), aliq_ipi numeric(9,4), valor_ipi numeric(15,2),
  cst_pis  varchar(2), base_pis  numeric(15,2), aliq_pis  numeric(9,4), valor_pis  numeric(15,2),
  cst_cofins varchar(2), base_cofins numeric(15,2), aliq_cofins numeric(9,4), valor_cofins numeric(15,2),
  outros              numeric(15,2),
  base_ibs_uf   numeric(15,2), aliq_ibs_uf  numeric(9,4), valor_ibs_uf  numeric(15,2), red_ibs_uf  numeric(9,4),
  base_ibs_mun  numeric(15,2), aliq_ibs_mun numeric(9,4), valor_ibs_mun numeric(15,2), red_ibs_mun numeric(9,4),
  base_cbs      numeric(15,2), aliq_cbs     numeric(9,4), valor_cbs     numeric(15,2), red_cbs     numeric(9,4),
  gera_credito        boolean DEFAULT false,
  valor_credito       numeric(15,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ap_nfe_id, item_seq)
);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_nfe  ON public.ap_nfe_itens (ap_nfe_id);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_ncm  ON public.ap_nfe_itens (ncm);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_cfop ON public.ap_nfe_itens (cfop);

-- ===========================================================================
-- 3) DE-PARA do Tipo de titulo Result
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_tipo_titulo_result (
  tipo_result char(1) PRIMARY KEY,
  descricao   text,
  usar_para_origem_huggs boolean NOT NULL DEFAULT false
);
INSERT INTO public.ap_tipo_titulo_result (tipo_result, descricao, usar_para_origem_huggs) VALUES
  ('9','Titulos originados/enviados por sistema (Huggs) — confirmar com Result', true)
ON CONFLICT (tipo_result) DO NOTHING;

-- ===========================================================================
-- 4) GRANTS + RLS (leitura via check_user_access; escrita só service_role/RPC)
-- ===========================================================================
GRANT SELECT ON public.ap_nfe                 TO authenticated;
GRANT SELECT ON public.ap_nfe_itens           TO authenticated;
GRANT SELECT ON public.ap_tipo_titulo_result  TO authenticated;
GRANT ALL    ON public.ap_nfe                 TO service_role;
GRANT ALL    ON public.ap_nfe_itens           TO service_role;
GRANT ALL    ON public.ap_tipo_titulo_result  TO service_role;

ALTER TABLE public.ap_nfe                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_nfe_itens          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_tipo_titulo_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY ap_nfe_sel        ON public.ap_nfe        FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));
CREATE POLICY ap_nfe_deny_anon  ON public.ap_nfe        FOR SELECT TO anon          USING (false);
CREATE POLICY ap_nfe_itens_sel  ON public.ap_nfe_itens  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));
CREATE POLICY ap_tipo_sel       ON public.ap_tipo_titulo_result FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));