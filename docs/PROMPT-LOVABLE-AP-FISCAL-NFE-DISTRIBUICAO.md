# PROMPT LOVABLE — Estrutura fiscal de DISTRIBUIÇÃO (NF-e de entrada) para o Contas a Pagar

Objetivo desta etapa: **criar só as tabelas** que espelham a estrutura fiscal de NF-e de entrada da distribuição (o padrão que já existe no ERP Result), para o Huggs poder **capturar e guardar** o documento fiscal vinculado ao contas a pagar. O fluxo (parser, tela, reconciliação) vem depois — aqui é só o schema.

**Princípios (decididos):**
- Domínio **distribuição** (filiais do contas a pagar), **separado** da stack `fabrica_*` (produção). Tabelas próprias `ap_nfe*`.
- Espelha o modelo do Result em 3 camadas: **recebimento/XML** (`ControleNfeEntrada`) → **item** (produto do XML) → **linha fiscal** (`NotasEntrada`, CFOP/CST/impostos).
- **IBS/CBS já criados** (inócuos sem dado — evitam migration dolorosa na Reforma; obrigatório a partir de 03/08/2026).
- Dinheiro em `numeric(15,2)`, alíquotas em `numeric(9,4)` (upgrade sobre o `float` do legado).
- Elo com o título: **`contas_pagar.chave_nfe` já existe e é indexado** → casa com `ap_nfe.chave_acesso`. 1 NF-e → N títulos (parcelas).
- RLS no molde do financeiro (`check_user_access(auth.uid(),'financeiro')`), escrita só service_role/RPC. NÃO usar `USING(true)`.

```sql
-- ===========================================================================
-- 1) CABEÇALHO / RECEBIMENTO DA NF-e DE ENTRADA (espelha dbo.ControleNfeEntrada)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_nfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso        varchar(44) NOT NULL UNIQUE,          -- elo com contas_pagar.chave_nfe
  empresa_id          integer,                              -- filial (dominio distribuicao)
  modelo              varchar(2),                           -- 55 (NF-e) / 65 (NFC-e)
  serie               integer,
  numero              bigint,
  natureza_operacao   text,
  -- emitente (do XML) + vinculo ao nosso cadastro
  emitente_cnpj       varchar(18),
  emitente_nome       varchar(120),
  fornecedor_id       uuid,                                 -- FK futura p/ fornecedores (cadastro canonico AP)
  -- datas / valores
  data_emissao        timestamptz,
  data_entrada        timestamptz,
  valor_total         numeric(15,2),
  valor_produtos      numeric(15,2),
  valor_frete         numeric(15,2),
  valor_desconto      numeric(15,2),
  -- documento
  xml_raw             text,                                 -- XML completo (ou usar xml_storage_path p/ arquivos grandes)
  xml_storage_path    text,                                 -- alternativa: XML no bucket documento-anexos
  danfe_url           text,
  -- integracao SEFAZ / manifestacao do destinatario (espelha *_NfeEnt)
  nsu                 varchar(30),                          -- NSU da distribuicao DFe
  status_sefaz        text,                                 -- autorizada/cancelada/denegada...
  cancelada           boolean NOT NULL DEFAULT false,
  manifestacao        text CHECK (manifestacao IN ('pendente','ciencia','confirmada','desconhecida','nao_realizada')) DEFAULT 'pendente',
  manifestacao_data   timestamptz,
  -- controle interno
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
-- 2) ITEM / LINHA FISCAL DA NF-e (espelha dbo.NotasEntrada "_LEnt" + o det do XML)
--    granularidade item/produto com todos os impostos, IBS/CBS-ready
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_nfe_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ap_nfe_id           uuid NOT NULL REFERENCES public.ap_nfe(id) ON DELETE CASCADE,
  item_seq            integer NOT NULL,                     -- nItem do XML
  -- produto
  codigo_produto      varchar(60),
  descricao           text,
  ncm                 varchar(8),
  cest                varchar(7),
  cfop                integer,
  unidade             varchar(6),
  quantidade          numeric(15,4),
  valor_unitario      numeric(15,6),
  valor_produto       numeric(15,2),
  valor_contabil      numeric(15,2),                        -- ValorContabil_LEnt
  -- classificacao tributaria (Reforma: cClassTrib)
  cst_icms            varchar(3),
  classe_tributaria   varchar(6),                           -- cClassTrib (Reforma)
  -- ICMS
  base_icms           numeric(15,2), aliq_icms numeric(9,4), valor_icms numeric(15,2),
  -- ICMS-ST
  base_icms_st        numeric(15,2), valor_icms_st numeric(15,2),
  -- IPI
  base_ipi            numeric(15,2), aliq_ipi numeric(9,4), valor_ipi numeric(15,2),
  -- PIS / COFINS
  cst_pis  varchar(2), base_pis  numeric(15,2), aliq_pis  numeric(9,4), valor_pis  numeric(15,2),
  cst_cofins varchar(2), base_cofins numeric(15,2), aliq_cofins numeric(9,4), valor_cofins numeric(15,2),
  outros              numeric(15,2),
  -- ===== REFORMA TRIBUTARIA (IBS estadual+municipal / CBS federal) — espelha *_LEnt do Result =====
  base_ibs_uf   numeric(15,2), aliq_ibs_uf  numeric(9,4), valor_ibs_uf  numeric(15,2), red_ibs_uf  numeric(9,4),
  base_ibs_mun  numeric(15,2), aliq_ibs_mun numeric(9,4), valor_ibs_mun numeric(15,2), red_ibs_mun numeric(9,4),
  base_cbs      numeric(15,2), aliq_cbs     numeric(9,4), valor_cbs     numeric(15,2), red_cbs     numeric(9,4),
  -- credito recuperavel (nao-cumulatividade)
  gera_credito        boolean DEFAULT false,
  valor_credito       numeric(15,2),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ap_nfe_id, item_seq)
);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_nfe  ON public.ap_nfe_itens (ap_nfe_id);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_ncm  ON public.ap_nfe_itens (ncm);
CREATE INDEX IF NOT EXISTS idx_ap_nfe_itens_cfop ON public.ap_nfe_itens (cfop);

-- ===========================================================================
-- 3) DE-PARA do Tipo de titulo Result (1 char, 1-9). Huggs origina com Tipo '9'
--    (informado pelo time Result = "titulos enviados por sistema"; parametrizavel).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ap_tipo_titulo_result (
  tipo_result char(1) PRIMARY KEY,                          -- '1'..'9'
  descricao   text,
  usar_para_origem_huggs boolean NOT NULL DEFAULT false     -- marca o tipo default do Huggs (hoje '9')
);
INSERT INTO public.ap_tipo_titulo_result (tipo_result, descricao, usar_para_origem_huggs) VALUES
  ('9','Titulos originados/enviados por sistema (Huggs) — confirmar com Result', true)
ON CONFLICT (tipo_result) DO NOTHING;

-- ===========================================================================
-- 4) RLS — molde do financeiro (leitura p/ quem tem o modulo; escrita so SECURITY DEFINER)
-- ===========================================================================
ALTER TABLE public.ap_nfe               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_nfe_itens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ap_tipo_titulo_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY ap_nfe_sel        ON public.ap_nfe        FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));
CREATE POLICY ap_nfe_deny_anon  ON public.ap_nfe        FOR SELECT TO anon USING (false);
CREATE POLICY ap_nfe_itens_sel  ON public.ap_nfe_itens  FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));
CREATE POLICY ap_tipo_sel       ON public.ap_tipo_titulo_result FOR SELECT TO authenticated USING (public.check_user_access(auth.uid(),'financeiro'));
-- SEM policy de INSERT/UPDATE/DELETE p/ authenticated: escrita so via service_role / RPC SECURITY DEFINER.

GRANT SELECT ON public.ap_nfe, public.ap_nfe_itens, public.ap_tipo_titulo_result TO authenticated;
```

## Verificação (após criar)
```sql
SELECT table_name, (SELECT count(*) FROM information_schema.columns c WHERE c.table_name=t.table_name) cols
FROM information_schema.tables t WHERE table_name IN ('ap_nfe','ap_nfe_itens','ap_tipo_titulo_result');
-- confirmar policies:
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'ap_nfe%' OR tablename='ap_tipo_titulo_result';
```

## O que NÃO entra agora (é o build do Passo 1, depois)
- Generalizar o `process-nfe-xml` para gravar em `ap_nfe*` (hoje grava em `fabrica_*`).
- Gravar `contas_pagar.chave_nfe` no nascimento (o bug de `CadastroTituloAP.tsx:183-199`).
- A tela de recebimento (upload XML) + reconciliação diferida pela chave + validação XML×manual.
- Vínculo `fornecedor_id` com o cadastro canônico de fornecedores.
