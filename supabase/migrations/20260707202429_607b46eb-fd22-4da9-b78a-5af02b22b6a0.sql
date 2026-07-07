
CREATE OR REPLACE FUNCTION public.fn_naturezas_erp_para_classificacao()
RETURNS TABLE(
  custo_tpg      bigint,
  ccusto_nome    text,
  historico_tpg  bigint,
  historico_nome text,
  setor_erp      text,
  qtd_titulos    bigint,
  volume_12m     numeric,
  categoria_dominante text,
  top_fornecedores    text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH base AS (
    SELECT
      cp.custo_tpg::bigint      AS custo_tpg,
      cc.descricao              AS ccusto_nome,
      cp.historico_tpg::bigint  AS historico_tpg,
      hi.descricao              AS historico_nome,
      cp.setor_nome             AS setor_erp,
      cp.valor_original::numeric AS valor,
      COALESCE(cp.categoria_nome,'') AS categoria_nome,
      COALESCE(cp.fornecedor_nome,'')::text AS fornecedor
    FROM public.erp_contas_pagar_rubysp cp
    LEFT JOIN public.erp_ccusto_rubysp       cc ON cc.rubysp_ccusto_id = cp.custo_tpg
    LEFT JOIN public.erp_plano_contas_rubysp hi ON hi.rubysp_hist_id   = cp.historico_tpg
    WHERE cp.data_emissao >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - INTERVAL '12 months'
  ),
  agg AS (
    SELECT
      custo_tpg, ccusto_nome, historico_tpg, historico_nome,
      MODE() WITHIN GROUP (ORDER BY setor_erp)       AS setor_erp,
      COUNT(*)::bigint                                AS qtd_titulos,
      SUM(valor)::numeric                             AS volume_12m,
      MODE() WITHIN GROUP (ORDER BY categoria_nome)  AS categoria_dominante
    FROM base
    GROUP BY custo_tpg, ccusto_nome, historico_tpg, historico_nome
  ),
  fornecedores AS (
    SELECT
      custo_tpg, historico_tpg,
      string_agg(fornecedor, ' | ' ORDER BY vol DESC) AS top_fornecedores
    FROM (
      SELECT
        custo_tpg, historico_tpg, fornecedor,
        SUM(valor) AS vol,
        ROW_NUMBER() OVER (PARTITION BY custo_tpg, historico_tpg ORDER BY SUM(valor) DESC) AS rn
      FROM base
      WHERE fornecedor <> ''
      GROUP BY custo_tpg, historico_tpg, fornecedor
    ) x
    WHERE rn <= 5
    GROUP BY custo_tpg, historico_tpg
  )
  SELECT
    a.custo_tpg, a.ccusto_nome, a.historico_tpg, a.historico_nome,
    a.setor_erp, a.qtd_titulos, a.volume_12m,
    a.categoria_dominante, f.top_fornecedores
  FROM agg a
  LEFT JOIN fornecedores f USING (custo_tpg, historico_tpg)
  ORDER BY a.volume_12m DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.fn_naturezas_erp_para_classificacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_naturezas_erp_para_classificacao() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_naturezas_erp_para_classificacao() TO service_role;

-- chart_of_accounts_v2
CREATE TABLE IF NOT EXISTS public.chart_of_accounts_v2 (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text NOT NULL UNIQUE,
  name         text NOT NULL,
  parent_id    uuid REFERENCES public.chart_of_accounts_v2(id) ON DELETE RESTRICT,
  nivel        int  NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('ativo','passivo','pl','receita','custo','despesa','resultado_fin','outros','impostos_resultado')),
  natureza     text,
  funcao_operacional text CHECK (funcao_operacional IN ('cmv','vendas','admin','logistica','financeiro','nao_aplicavel')) DEFAULT 'nao_aplicavel',
  grupo_ifrs18 text CHECK (grupo_ifrs18 IN ('operating','investing','financing','discontinued','other')) DEFAULT 'operating',
  analitica    boolean NOT NULL DEFAULT false,
  ativo        boolean NOT NULL DEFAULT true,
  ordem        int,
  deprecated_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts_v2 TO authenticated;
GRANT ALL ON public.chart_of_accounts_v2 TO service_role;
ALTER TABLE public.chart_of_accounts_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coa_v2_admin_all" ON public.chart_of_accounts_v2
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "coa_v2_read_authenticated" ON public.chart_of_accounts_v2
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_coa_v2_parent ON public.chart_of_accounts_v2 (parent_id);
CREATE INDEX IF NOT EXISTS idx_coa_v2_code   ON public.chart_of_accounts_v2 (code);
CREATE INDEX IF NOT EXISTS idx_coa_v2_ativo  ON public.chart_of_accounts_v2 (ativo) WHERE ativo;

CREATE OR REPLACE FUNCTION public.tg_coa_v2_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_coa_v2_touch ON public.chart_of_accounts_v2;
CREATE TRIGGER trg_coa_v2_touch BEFORE UPDATE ON public.chart_of_accounts_v2
FOR EACH ROW EXECUTE FUNCTION public.tg_coa_v2_touch();

-- erp_dre_mapa_v2
CREATE TABLE IF NOT EXISTS public.erp_dre_mapa_v2 (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custo_tpg        bigint,
  historico_tpg    bigint,
  complemento_like text,
  plano_code_v2    text NOT NULL REFERENCES public.chart_of_accounts_v2(code) ON DELETE RESTRICT,
  departamento_id  uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  origem           text NOT NULL CHECK (origem IN ('ia','humano','importado')) DEFAULT 'ia',
  prioridade       int  NOT NULL DEFAULT 10,
  auditor_id       uuid REFERENCES auth.users(id),
  auditado_em      timestamptz,
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custo_tpg, historico_tpg, complemento_like)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_dre_mapa_v2 TO authenticated;
GRANT ALL ON public.erp_dre_mapa_v2 TO service_role;
ALTER TABLE public.erp_dre_mapa_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mapa_v2_admin_all" ON public.erp_dre_mapa_v2
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_mapa_v2_lookup
  ON public.erp_dre_mapa_v2 (custo_tpg, historico_tpg, prioridade) WHERE ativo;

DROP TRIGGER IF EXISTS trg_mapa_v2_touch ON public.erp_dre_mapa_v2;
CREATE TRIGGER trg_mapa_v2_touch BEFORE UPDATE ON public.erp_dre_mapa_v2
FOR EACH ROW EXECUTE FUNCTION public.tg_coa_v2_touch();

-- natureza_erp_classificacao_ia
CREATE TABLE IF NOT EXISTS public.natureza_erp_classificacao_ia (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custo_tpg      bigint,
  historico_tpg  bigint,
  ccusto_nome    text,
  historico_nome text,
  setor_erp      text,
  volume_12m     numeric,
  qtd_titulos    bigint,
  top_fornecedores text,
  categoria_dominante text,
  conta_code_v2  text,
  conta_name_v2  text,
  tipo           text,
  natureza       text,
  funcao_operacional text,
  confidence     numeric CHECK (confidence BETWEEN 0 AND 1),
  rationale      text,
  model          text,
  ia_run_id      uuid,
  status         text NOT NULL DEFAULT 'pendente_auditoria'
                 CHECK (status IN ('pendente_auditoria','aprovada','editada','rejeitada')),
  conta_final_code text,
  conta_final_dept_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  auditor_id     uuid REFERENCES auth.users(id),
  auditado_em    timestamptz,
  auditor_nota   text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custo_tpg, historico_tpg)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.natureza_erp_classificacao_ia TO authenticated;
GRANT ALL ON public.natureza_erp_classificacao_ia TO service_role;
ALTER TABLE public.natureza_erp_classificacao_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nat_ia_admin_all" ON public.natureza_erp_classificacao_ia
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_nat_ia_status ON public.natureza_erp_classificacao_ia (status, volume_12m DESC);

DROP TRIGGER IF EXISTS trg_nat_ia_touch ON public.natureza_erp_classificacao_ia;
CREATE TRIGGER trg_nat_ia_touch BEFORE UPDATE ON public.natureza_erp_classificacao_ia
FOR EACH ROW EXECUTE FUNCTION public.tg_coa_v2_touch();

-- SEED IFRS 18
INSERT INTO public.chart_of_accounts_v2 (code, name, nivel, tipo, natureza, funcao_operacional, grupo_ifrs18, analitica, ordem)
VALUES
('1',       'Ativo', 1, 'ativo', 'total_ativo', 'nao_aplicavel', 'operating', false, 100),
('1.1',     'Ativo Circulante', 2, 'ativo', 'circulante', 'nao_aplicavel', 'operating', false, 110),
('1.1.01',  'Caixa e Equivalentes de Caixa', 3, 'ativo', 'caixa_equivalentes', 'nao_aplicavel', 'operating', false, 111),
('1.1.02',  'Aplicações Financeiras de Curto Prazo', 3, 'ativo', 'aplicacoes_cp', 'nao_aplicavel', 'operating', false, 112),
('1.1.03',  'Contas a Receber de Clientes', 3, 'ativo', 'clientes', 'nao_aplicavel', 'operating', false, 113),
('1.1.04',  'Estoques', 3, 'ativo', 'estoques', 'nao_aplicavel', 'operating', false, 114),
('1.1.05',  'Impostos a Recuperar', 3, 'ativo', 'impostos_recuperar', 'nao_aplicavel', 'operating', false, 115),
('1.1.06',  'Adiantamentos a Fornecedores', 3, 'ativo', 'adiantamentos', 'nao_aplicavel', 'operating', false, 116),
('1.1.99',  'Outros Ativos Circulantes', 3, 'ativo', 'outros_ac', 'nao_aplicavel', 'operating', false, 119),
('1.2',     'Ativo Não Circulante', 2, 'ativo', 'nao_circulante', 'nao_aplicavel', 'investing', false, 120),
('1.2.01',  'Realizável a Longo Prazo', 3, 'ativo', 'realizavel_lp', 'nao_aplicavel', 'investing', false, 121),
('1.2.02',  'Investimentos', 3, 'ativo', 'investimentos', 'nao_aplicavel', 'investing', false, 122),
('1.2.03',  'Imobilizado', 3, 'ativo', 'imobilizado', 'nao_aplicavel', 'investing', false, 123),
('1.2.04',  'Intangível', 3, 'ativo', 'intangivel', 'nao_aplicavel', 'investing', false, 124),

('2',       'Passivo', 1, 'passivo', 'total_passivo', 'nao_aplicavel', 'operating', false, 200),
('2.1',     'Passivo Circulante', 2, 'passivo', 'circulante', 'nao_aplicavel', 'operating', false, 210),
('2.1.01',  'Fornecedores', 3, 'passivo', 'fornecedores', 'nao_aplicavel', 'operating', false, 211),
('2.1.02',  'Empréstimos e Financiamentos CP', 3, 'passivo', 'emprestimos_cp', 'nao_aplicavel', 'financing', false, 212),
('2.1.03',  'Obrigações Trabalhistas e Sociais', 3, 'passivo', 'obrigacoes_trab', 'nao_aplicavel', 'operating', false, 213),
('2.1.04',  'Obrigações Tributárias', 3, 'passivo', 'obrigacoes_trib', 'nao_aplicavel', 'operating', false, 214),
('2.1.05',  'Adiantamentos de Clientes', 3, 'passivo', 'adiantamento_clientes', 'nao_aplicavel', 'operating', false, 215),
('2.1.99',  'Outros Passivos Circulantes', 3, 'passivo', 'outros_pc', 'nao_aplicavel', 'operating', false, 219),
('2.2',     'Passivo Não Circulante', 2, 'passivo', 'nao_circulante', 'nao_aplicavel', 'financing', false, 220),
('2.2.01',  'Empréstimos e Financiamentos LP', 3, 'passivo', 'emprestimos_lp', 'nao_aplicavel', 'financing', false, 221),
('2.2.02',  'Provisões', 3, 'passivo', 'provisoes', 'nao_aplicavel', 'operating', false, 222),

('3',       'Patrimônio Líquido', 1, 'pl', 'total_pl', 'nao_aplicavel', 'financing', false, 300),
('3.1',     'Capital Social', 2, 'pl', 'capital', 'nao_aplicavel', 'financing', false, 310),
('3.2',     'Reservas de Lucros', 2, 'pl', 'reservas', 'nao_aplicavel', 'financing', false, 320),
('3.3',     'Lucros Acumulados', 2, 'pl', 'lucros_acumulados', 'nao_aplicavel', 'financing', false, 330),

('4',       'Receita Operacional', 1, 'receita', 'receita_bruta', 'nao_aplicavel', 'operating', false, 400),
('4.1',     'Receita Bruta de Vendas', 2, 'receita', 'venda_produtos', 'nao_aplicavel', 'operating', false, 410),
('4.1.01',  'Vendas de Produtos Acabados', 3, 'receita', 'venda_produtos', 'nao_aplicavel', 'operating', true, 411),
('4.1.02',  'Vendas de Mercadorias', 3, 'receita', 'venda_mercadorias', 'nao_aplicavel', 'operating', true, 412),
('4.1.03',  'Prestação de Serviços', 3, 'receita', 'servicos', 'nao_aplicavel', 'operating', true, 413),
('4.2',     'Deduções da Receita Bruta', 2, 'receita', 'deducoes', 'nao_aplicavel', 'operating', false, 420),
('4.2.01',  'Devoluções e Abatimentos', 3, 'receita', 'devolucoes', 'nao_aplicavel', 'operating', true, 421),
('4.2.02',  'Impostos sobre Vendas (ICMS/PIS/COFINS/ISS)', 3, 'receita', 'impostos_venda', 'nao_aplicavel', 'operating', true, 422),

('5',       'Custo dos Produtos Vendidos', 1, 'custo', 'cpv', 'cmv', 'operating', false, 500),
('5.1',     'Custo de Matéria-Prima', 2, 'custo', 'materia_prima', 'cmv', 'operating', true, 510),
('5.2',     'Custo de Embalagem', 2, 'custo', 'embalagem', 'cmv', 'operating', true, 520),
('5.3',     'Mão de Obra Direta', 2, 'custo', 'mao_obra_direta', 'cmv', 'operating', true, 530),
('5.4',     'Custos Indiretos de Fabricação', 2, 'custo', 'cif', 'cmv', 'operating', true, 540),
('5.5',     'Frete sobre Compras', 2, 'custo', 'frete_compras', 'cmv', 'operating', true, 550),

('6',       'Despesas Operacionais', 1, 'despesa', 'despesas_op', 'nao_aplicavel', 'operating', false, 600),
('6.1',     'Despesas com Vendas', 2, 'despesa', 'despesas_venda', 'vendas', 'operating', false, 610),
('6.1.01',  'Comissões de Vendas', 3, 'despesa', 'comissoes', 'vendas', 'operating', true, 611),
('6.1.02',  'Marketing e Publicidade', 3, 'despesa', 'marketing', 'vendas', 'operating', true, 612),
('6.1.03',  'Trade Marketing', 3, 'despesa', 'trade_marketing', 'vendas', 'operating', true, 613),
('6.1.04',  'Frete sobre Vendas', 3, 'despesa', 'frete_vendas', 'vendas', 'operating', true, 614),
('6.1.05',  'Viagens e Representação Comercial', 3, 'despesa', 'viagens_venda', 'vendas', 'operating', true, 615),
('6.2',     'Despesas Administrativas', 2, 'despesa', 'despesas_adm', 'admin', 'operating', false, 620),
('6.2.01',  'Pessoal Administrativo (Salários e Encargos)', 3, 'despesa', 'pessoal_adm', 'admin', 'operating', true, 621),
('6.2.02',  'Honorários da Diretoria', 3, 'despesa', 'honorarios_diretoria', 'admin', 'operating', true, 622),
('6.2.03',  'Serviços de Terceiros - Consultoria', 3, 'despesa', 'consultoria', 'admin', 'operating', true, 623),
('6.2.04',  'Serviços de Terceiros - Contábeis e Jurídicos', 3, 'despesa', 'contabil_juridico', 'admin', 'operating', true, 624),
('6.2.05',  'Aluguéis e Condomínio Administrativo', 3, 'despesa', 'aluguel_adm', 'admin', 'operating', true, 625),
('6.2.06',  'Utilidades (Energia, Água, Telecom, Internet)', 3, 'despesa', 'utilidades', 'admin', 'operating', true, 626),
('6.2.07',  'Tecnologia e Software (SaaS)', 3, 'despesa', 'tecnologia', 'admin', 'operating', true, 627),
('6.2.08',  'Materiais de Escritório e Consumo', 3, 'despesa', 'materiais_escritorio', 'admin', 'operating', true, 628),
('6.2.09',  'Viagens Administrativas', 3, 'despesa', 'viagens_adm', 'admin', 'operating', true, 629),
('6.2.10',  'Seguros', 3, 'despesa', 'seguros', 'admin', 'operating', true, 630),
('6.2.11',  'Treinamento e Desenvolvimento', 3, 'despesa', 'treinamento', 'admin', 'operating', true, 631),
('6.2.12',  'Depreciação e Amortização Administrativas', 3, 'despesa', 'depreciacao_adm', 'admin', 'operating', true, 632),
('6.3',     'Despesas Logísticas', 2, 'despesa', 'despesas_log', 'logistica', 'operating', false, 640),
('6.3.01',  'Armazenagem', 3, 'despesa', 'armazenagem', 'logistica', 'operating', true, 641),
('6.3.02',  'Frete Interno / Transferências', 3, 'despesa', 'frete_interno', 'logistica', 'operating', true, 642),
('6.3.03',  'Embalagem para Expedição', 3, 'despesa', 'embalagem_expedicao', 'logistica', 'operating', true, 643),
('6.3.04',  'Movimentação e Manuseio', 3, 'despesa', 'movimentacao', 'logistica', 'operating', true, 644),
('6.3.05',  'Despacho Aduaneiro e Importação', 3, 'despesa', 'aduana', 'logistica', 'operating', true, 645),
('6.4',     'Outras Despesas Operacionais', 2, 'despesa', 'outras_op', 'nao_aplicavel', 'operating', false, 650),
('6.4.01',  'Perdas de Estoque e Inventário', 3, 'despesa', 'perdas_estoque', 'nao_aplicavel', 'operating', true, 651),
('6.4.02',  'Provisão para Devedores Duvidosos (PDD)', 3, 'despesa', 'pdd', 'nao_aplicavel', 'operating', true, 652),
('6.4.03',  'Contingências Cíveis e Trabalhistas', 3, 'despesa', 'contingencias', 'nao_aplicavel', 'operating', true, 653),

('7',       'Resultado Financeiro', 1, 'resultado_fin', 'resultado_fin', 'financeiro', 'financing', false, 700),
('7.1',     'Receitas Financeiras', 2, 'resultado_fin', 'rec_fin', 'financeiro', 'financing', false, 710),
('7.1.01',  'Rendimentos de Aplicações', 3, 'resultado_fin', 'rendimentos', 'financeiro', 'financing', true, 711),
('7.1.02',  'Juros Ativos e Descontos Obtidos', 3, 'resultado_fin', 'juros_ativos', 'financeiro', 'financing', true, 712),
('7.2',     'Despesas Financeiras', 2, 'resultado_fin', 'desp_fin', 'financeiro', 'financing', false, 720),
('7.2.01',  'Juros sobre Empréstimos', 3, 'resultado_fin', 'juros_emprestimo', 'financeiro', 'financing', true, 721),
('7.2.02',  'Taxas e Tarifas Bancárias', 3, 'resultado_fin', 'tarifas_bancarias', 'financeiro', 'financing', true, 722),
('7.2.03',  'IOF', 3, 'resultado_fin', 'iof', 'financeiro', 'financing', true, 723),
('7.2.04',  'Variação Cambial Passiva', 3, 'resultado_fin', 'var_cambial_passiva', 'financeiro', 'financing', true, 724),
('7.2.05',  'Juros de Mora Pagos', 3, 'resultado_fin', 'juros_mora', 'financeiro', 'financing', true, 725),

('8',       'Outros Resultados', 1, 'outros', 'outros_res', 'nao_aplicavel', 'other', false, 800),
('8.1',     'Ganhos e Perdas de Capital', 2, 'outros', 'ganhos_capital', 'nao_aplicavel', 'investing', true, 810),
('8.2',     'Resultado de Equivalência Patrimonial', 2, 'outros', 'equiv_patrimonial', 'nao_aplicavel', 'investing', true, 820),
('8.3',     'Outras Receitas Não Operacionais', 2, 'outros', 'outras_rec_nop', 'nao_aplicavel', 'other', true, 830),
('8.4',     'Outras Despesas Não Operacionais', 2, 'outros', 'outras_desp_nop', 'nao_aplicavel', 'other', true, 840),

('9',       'Impostos sobre o Resultado', 1, 'impostos_resultado', 'ir_csll', 'nao_aplicavel', 'operating', false, 900),
('9.1',     'IRPJ - Imposto de Renda Pessoa Jurídica', 2, 'impostos_resultado', 'irpj', 'nao_aplicavel', 'operating', true, 910),
('9.2',     'CSLL - Contribuição Social sobre o Lucro Líquido', 2, 'impostos_resultado', 'csll', 'nao_aplicavel', 'operating', true, 920)
ON CONFLICT (code) DO NOTHING;

-- resolve parent_id pelo prefixo do code
UPDATE public.chart_of_accounts_v2 c
   SET parent_id = p.id
  FROM public.chart_of_accounts_v2 p
 WHERE c.parent_id IS NULL
   AND c.nivel > 1
   AND p.code = regexp_replace(c.code, '\.[^.]+$', '')
   AND length(p.code) < length(c.code);
