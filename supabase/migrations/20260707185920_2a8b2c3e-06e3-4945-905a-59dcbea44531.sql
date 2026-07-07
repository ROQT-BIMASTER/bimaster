
-- 1. 4 CONTAS NOVAS (INSERT idempotente por code)
INSERT INTO public.trade_chart_of_accounts (code, name, account_type, categoria_dre, parent_account_id, nivel, is_group, is_active, permite_lancamento)
SELECT v.code, v.name, v.account_type, v.categoria_dre, v.parent_account_id, v.nivel, v.is_group, v.is_active, v.permite_lancamento
FROM (VALUES
  ('2.1.4',  'ICMS-ST sobre Compras',                       'expense'::text, 'custo_vendas'::text,   (SELECT id FROM public.trade_chart_of_accounts WHERE code='2.1' LIMIT 1), 3, false, true, true),
  ('2.5.7',  'IRPJ e CSLL (DARF)',                          'expense',       'impostos_lucro',       (SELECT id FROM public.trade_chart_of_accounts WHERE code='2.5' LIMIT 1), 3, false, true, true),
  ('3.2.16', 'Encargos Sociais (FGTS/INSS)',                'expense',       'despesas_fixas',       (SELECT id FROM public.trade_chart_of_accounts WHERE code='3.2' LIMIT 1), 3, false, true, true),
  ('4.2.8',  'Adiantamentos e Depósitos em Garantia ( - )', 'asset',         NULL,                   (SELECT id FROM public.trade_chart_of_accounts WHERE code='4.2' LIMIT 1), 3, false, true, true)
) AS v(code, name, account_type, categoria_dre, parent_account_id, nivel, is_group, is_active, permite_lancamento)
WHERE NOT EXISTS (SELECT 1 FROM public.trade_chart_of_accounts t WHERE t.code = v.code);

-- 2. Departamentos canônicos faltantes
INSERT INTO public.departamentos (nome, ativo) VALUES ('Fiscal/Tributário', true) ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.departamentos (nome, ativo) VALUES ('Diretoria/Sócios',  true) ON CONFLICT (nome) DO NOTHING;
INSERT INTO public.departamentos (nome, ativo) VALUES ('Compras / CMV',     true) ON CONFLICT (nome) DO NOTHING;

-- 3. View canônica
CREATE OR REPLACE VIEW public.vw_departamento_canonico AS
SELECT * FROM (VALUES
  ('COMERCIAL',          (SELECT id FROM public.departamentos WHERE nome='Comercial / Trade')),
  ('MARKETING',          (SELECT id FROM public.departamentos WHERE nome='Marketing Atualizado')),
  ('LOGISTICA',          (SELECT id FROM public.departamentos WHERE nome='Logística')),
  ('FINANCEIRO',         (SELECT id FROM public.departamentos WHERE nome='Financeiro')),
  ('RECURSOS HUMANOS',   (SELECT id FROM public.departamentos WHERE nome='Recursos Humanos')),
  ('FISCAL/TRIBUTARIO',  (SELECT id FROM public.departamentos WHERE nome='Fiscal/Tributário')),
  ('TI',                 (SELECT id FROM public.departamentos WHERE nome='TI')),
  ('ADMINISTRATIVO',     (SELECT id FROM public.departamentos WHERE nome='Administrativo')),
  ('COMPRAS / CMV',      (SELECT id FROM public.departamentos WHERE nome='Compras / CMV')),
  ('DIRETORIA/SOCIOS',   (SELECT id FROM public.departamentos WHERE nome='Diretoria/Sócios'))
) AS v(nome_canonico, departamento_id);

GRANT SELECT ON public.vw_departamento_canonico TO authenticated, anon;

-- 4. erp_setor_depara
CREATE TABLE IF NOT EXISTS public.erp_setor_depara (
  setor_id      integer PRIMARY KEY,
  setor_nome    text NOT NULL,
  departamento  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erp_setor_depara TO authenticated;
GRANT ALL    ON public.erp_setor_depara TO service_role;
ALTER TABLE public.erp_setor_depara ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_setor_depara select authenticated" ON public.erp_setor_depara;
CREATE POLICY "erp_setor_depara select authenticated" ON public.erp_setor_depara FOR SELECT TO authenticated USING (true);

TRUNCATE TABLE public.erp_setor_depara;
INSERT INTO public.erp_setor_depara (setor_id, setor_nome, departamento) VALUES
  (1,'RECURSOS HUMANOS','RECURSOS HUMANOS'),
  (2,'DEPARTAMENTO LOGISTICA','LOGISTICA'),
  (3,'DEPARTAMENTO FINANCEIRO','FINANCEIRO'),
  (4,'DEPARTAMENTO COMERCIAL','COMERCIAL'),
  (5,'DEPARTAMENTO DE MARKETING','MARKETING'),
  (6,'DEPARTAMENTO FISCAL / TRIBUTÁRIO','FISCAL/TRIBUTARIO'),
  (7,'DEPARTAMENTO DE TI','TI'),
  (8,'DEPARTAMENTO ADMINISTRATIVO','ADMINISTRATIVO'),
  (9,'DEPARTAMENTO DE INSUMOS/PRODUTOS','COMPRAS / CMV'),
  (10,'CHEQUES / COMPRAS CMV','COMPRAS / CMV'),
  (100,'100 / TRADE MARKETING','MARKETING'),
  (200,'200 / INFLUENCER - MARKETING','MARKETING'),
  (300,'300 / CAMPANHA - MARKETING','MARKETING'),
  (400,'400 / MIDIA PERFORMACE - MARKETING','MARKETING'),
  (500,'500 / CRIAÇÃO - MKT','MARKETING'),
  (600,'600 / CONTEÚDO - MKT','MARKETING'),
  (21208,'OUTRAS CONTAS A PAGAR','ADMINISTRATIVO');

-- 5. erp_dre_mapa
CREATE TABLE IF NOT EXISTS public.erp_dre_mapa (
  id                bigserial PRIMARY KEY,
  ccusto_id         integer,
  historico_id      integer,
  complemento_like  text,
  plano_code        text NOT NULL,
  departamento      text NOT NULL,
  prioridade        integer NOT NULL,
  obs               text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_erp_dre_mapa_ccusto_hist ON public.erp_dre_mapa (ccusto_id, historico_id, prioridade);
CREATE INDEX IF NOT EXISTS idx_erp_dre_mapa_historico   ON public.erp_dre_mapa (historico_id) WHERE ccusto_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_erp_dre_mapa_prio        ON public.erp_dre_mapa (prioridade);
GRANT SELECT ON public.erp_dre_mapa TO authenticated;
GRANT ALL    ON public.erp_dre_mapa TO service_role;
ALTER TABLE public.erp_dre_mapa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "erp_dre_mapa select authenticated" ON public.erp_dre_mapa;
CREATE POLICY "erp_dre_mapa select authenticated" ON public.erp_dre_mapa FOR SELECT TO authenticated USING (true);

TRUNCATE TABLE public.erp_dre_mapa RESTART IDENTITY;

-- prio 5: complementos com combo específico
INSERT INTO public.erp_dre_mapa (ccusto_id, historico_id, complemento_like, plano_code, departamento, prioridade, obs) VALUES
(35,   258, '%ST%',        '2.1.4','COMPRAS / CMV',    5, 'complemento ST no combo EVENTUAIS×REEMBOLSO → ICMS-ST'),
(14,   123, '%FRONTEIRA%', '2.5.2','FISCAL/TRIBUTARIO',5, 'complemento FRONTEIRA no combo SALARIO×IMPOSTOS/TAXAS → ICMS/GNRE'),
(2,    136, '%CAUC%',      '4.2.8','ADMINISTRATIVO',   5, 'complemento CAUÇÃO no combo ALUGUEIS×LOCAÇÃO → depósito em garantia');

-- prio 10: combos
INSERT INTO public.erp_dre_mapa (ccusto_id, historico_id, complemento_like, plano_code, departamento, prioridade, obs) VALUES
(1,1,NULL,'2.1.1.3','COMPRAS / CMV',10,'CMV × COMPRA REVENDA'),
(16,3,NULL,'EXCLUIR','FINANCEIRO',10,'DESP FIN × TRANSF (-)'),
(15,207,NULL,'2.5.7','FISCAL/TRIBUTARIO',10,'DESP TRIB × TRIBUTOS FEDERAIS'),
(29,232,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × COMISSAO'),
(15,208,NULL,'2.5.2','FISCAL/TRIBUTARIO',10,'DESP TRIB × TRIBUTOS ESTADUAIS'),
(29,185,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × REPRESENTANTES'),
(5,104,NULL,'2.4.1','LOGISTICA',10,'TRANSPORTE × TRANSPORTADORA VENDAS ONLINE'),
(14,108,NULL,'3.2.1.1','RECURSOS HUMANOS',10,'SALARIO × SALARIOS'),
(54,291,NULL,'3.3.8','MARKETING',10,'DIREITOS AUTORAIS × ROYALTIES'),
(38,234,NULL,'2.1.1.3','COMPRAS / CMV',10,'MARCA RUBY ROSE × RUBY ROSE MARCA'),
(14,239,NULL,'3.2.1.1','RECURSOS HUMANOS',10,'SALARIO × ADIANT SALARIOS'),
(0,280,NULL,'4.4.2','DIRETORIA/SOCIOS',10,'× DISTRIBUIÇÃO LUCRO'),
(29,187,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × GERENTES'),
(2,9,NULL,'3.1.1.1','LOGISTICA',10,'ALUGUEIS × ALUGUEL DEPÓSITO'),
(280,280,NULL,'4.4.2','DIRETORIA/SOCIOS',10,'DIST LUCRO × DIST LUCRO'),
(46,267,NULL,'4.4.2','DIRETORIA/SOCIOS',10,'Dividendos × Pgto Dividendos'),
(11,94,NULL,'3.1.22','TI',10,'TI × SOFTWARE'),
(5,96,NULL,'2.4.1','LOGISTICA',10,'TRANSPORTE × SUL'),
(33,123,NULL,'3.1.6.2','FISCAL/TRIBUTARIO',10,'IMPOSTOS × IMPOSTOS/TAXAS'),
(14,171,NULL,'3.2.12.1','RECURSOS HUMANOS',10,'SALARIO × ALIMENTAÇÃO'),
(4,31,NULL,'3.1.23','FINANCEIRO',10,'CAIXA INTERNO × DINHEIRO COFRE'),
(32,3,NULL,'EXCLUIR','FINANCEIRO',10,'RECEITAS FIN × TRANSF (-)'),
(5,217,NULL,'2.4.2','LOGISTICA',10,'TRANSPORTE × FRETES AGREGADOS'),
(14,244,NULL,'3.2.2','RECURSOS HUMANOS',10,'SALARIO × CONTRATADO PJ'),
(34,211,NULL,'2.2.4','LOGISTICA',10,'EMBALAGENS × EMBALAGENS'),
(14,123,NULL,'3.2.16','RECURSOS HUMANOS',10,'SALARIO × IMPOSTOS TAXAS (encargos folha)'),
(14,125,NULL,'3.2.3','RECURSOS HUMANOS',10,'SALARIO × VALE TRANSPORTE'),
(63,308,NULL,'4.2.8','COMPRAS / CMV',10,'ADIANT FORNEC × ADIANT FORNEC'),
(29,186,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × SUPERVISORES'),
(29,192,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × REPRESENTANTES 192'),
(48,269,NULL,'4.4.2','DIRETORIA/SOCIOS',10,'DIVIDENDOS × Pgto Dividendos'),
(3,20,NULL,'3.3.6','MARKETING',10,'CONSULTORES × CONSULTORIA MKT'),
(45,256,NULL,'4.2.3','LOGISTICA',10,'ATIVO IMOB × PORTA PALETES'),
(5,55,NULL,'2.4.1','LOGISTICA',10,'TRANSPORTE × FRETE TERCEIRISTA'),
(35,258,NULL,'3.1.17','ADMINISTRATIVO',10,'EVENTUAIS × REEMBOLSO'),
(16,287,NULL,'3.1.23','ADMINISTRATIVO',10,'DESP FIN × CHEQUE'),
(5,54,NULL,'2.4.6','LOGISTICA',10,'TRANSPORTE × FRETE FORNECEDOR'),
(41,286,NULL,'EXCLUIR','FINANCEIRO',10,'AJUSTE SALDO × DEPÓSITO CHEQUE DEVOLVIDO'),
(5,24,NULL,'2.4.3','LOGISTICA',10,'TRANSPORTE × CORREIOS'),
(35,291,NULL,'3.3.8','MARKETING',10,'EVENTUAIS × ROYALTIES'),
(14,124,NULL,'3.2.12.1','RECURSOS HUMANOS',10,'SALARIO × BENEFICIOS CESTAS'),
(27,265,NULL,'2.6.2','COMERCIAL',10,'CUSTO VENDAS × AJUDA CUSTO'),
(33,264,NULL,'2.5.2','FISCAL/TRIBUTARIO',10,'IMPOSTOS × ICMS'),
(25,174,NULL,'3.1.8.12','COMERCIAL',10,'EVENTOS INT × PREST SERV TERCEIRIZ'),
(108,250,NULL,'3.5.1','DIRETORIA/SOCIOS',10,'PRO LABORE × PRO LABORE'),
(16,107,NULL,'3.4.1','FINANCEIRO',10,'DESP FIN × TARIFAS BANC'),
(14,270,NULL,'3.2.12.2','RECURSOS HUMANOS',10,'SALARIO × PLANO SAUDE'),
(3,81,NULL,'3.1.8.12','ADMINISTRATIVO',10,'CONSULTORES × RECRUTAMENTO'),
(57,294,NULL,'3.3.5','MARKETING',10,'DISPLAY × DISPLAY'),
(15,235,NULL,'2.5.2','FISCAL/TRIBUTARIO',10,'DESP TRIB × IMPOSTO ESTADUAL'),
(3,22,NULL,'3.1.8.3','ADMINISTRATIVO',10,'CONSULTORES × CONTABILIDADE EXT'),
(14,121,NULL,'3.2.7','RECURSOS HUMANOS',10,'SALARIO × 13º SALARIO'),
(7,39,NULL,'3.1.9.2','LOGISTICA',10,'MANUTENÇÃO × EMPILHADEIRA'),
(2,136,NULL,'3.1.19','ADMINISTRATIVO',10,'ALUGUEIS × LOCAÇÃO'),
(27,180,NULL,'2.1.2','COMPRAS / CMV',10,'CUSTO VENDAS × PGTO DEVOLUÇÃO'),
(16,225,NULL,'3.1.20','FINANCEIRO',10,'DESP FIN × CARTÃO CRÉDITO'),
(19,273,NULL,'EXCLUIR','FINANCEIRO',10,'APLICAÇÃO × APLICAÇÃO FIN'),
(14,122,NULL,'3.2.8','RECURSOS HUMANOS',10,'SALARIO × FÉRIAS'),
(29,196,NULL,'2.6.1','COMERCIAL',10,'COMISSÕES × RESCISÃO'),
(12,66,NULL,'3.1.10.1','LOGISTICA',10,'TRANSP PRÓPRIO × MANUTENÇÃO/ACESS');

-- prio 20: por histórico
INSERT INTO public.erp_dre_mapa (ccusto_id, historico_id, complemento_like, plano_code, departamento, prioridade, obs) VALUES
(NULL,3,NULL,'EXCLUIR','FINANCEIRO',20,'histórico TRANSF (-)'),
(NULL,4,NULL,'EXCLUIR','FINANCEIRO',20,'histórico TRANSF (+)'),
(NULL,267,NULL,'4.4.2','DIRETORIA/SOCIOS',20,'histórico Pgto Dividendos 267'),
(NULL,268,NULL,'4.4.2','DIRETORIA/SOCIOS',20,'histórico Pgto Dividendos 268'),
(NULL,269,NULL,'4.4.2','DIRETORIA/SOCIOS',20,'histórico Pgto Dividendos 269'),
(NULL,280,NULL,'4.4.2','DIRETORIA/SOCIOS',20,'histórico DIST LUCRO'),
(NULL,291,NULL,'3.3.8','MARKETING',20,'histórico ROYALTIES');

-- prio 30: fallback centro
INSERT INTO public.erp_dre_mapa (ccusto_id, historico_id, complemento_like, plano_code, departamento, prioridade, obs) VALUES
(1,NULL,NULL,'2.1.1.3','COMPRAS / CMV',30,'fallback CMV COMPRAS'),
(2,NULL,NULL,'3.1.19','ADMINISTRATIVO',30,'fallback ALUGUEIS'),
(3,NULL,NULL,'3.1.8.9','ADMINISTRATIVO',30,'fallback CONSULTORES/TERCEIROS'),
(4,NULL,NULL,'3.1.23','FINANCEIRO',30,'fallback CAIXA INTERNO'),
(5,NULL,NULL,'2.4.1','LOGISTICA',30,'fallback TRANSPORTE'),
(7,NULL,NULL,'3.1.9.1','ADMINISTRATIVO',30,'fallback MANUTENÇÃO'),
(8,NULL,NULL,'3.1.11.1','ADMINISTRATIVO',30,'fallback SEGUROS'),
(9,NULL,NULL,'3.1.2','ADMINISTRATIVO',30,'fallback UTILIDADES'),
(10,NULL,NULL,'3.1.8.1','ADMINISTRATIVO',30,'fallback SEGURANÇA'),
(11,NULL,NULL,'3.1.22','TI',30,'fallback TI'),
(12,NULL,NULL,'3.1.10.1','LOGISTICA',30,'fallback TRANSP PRÓPRIO'),
(13,NULL,NULL,'4.2.3','LOGISTICA',30,'fallback WAREHOUSE'),
(14,NULL,NULL,'3.2.14','RECURSOS HUMANOS',30,'fallback SALARIO'),
(15,NULL,NULL,'2.5.2','FISCAL/TRIBUTARIO',30,'fallback DESP TRIB'),
(16,NULL,NULL,'3.4.1','FINANCEIRO',30,'fallback DESP FIN'),
(17,NULL,NULL,'3.3.13','MARKETING',30,'fallback ASSESSORIA'),
(19,NULL,NULL,'EXCLUIR','FINANCEIRO',30,'fallback APLICAÇÃO'),
(20,NULL,NULL,'3.3.2','MARKETING',30,'fallback EVENTOS'),
(21,NULL,NULL,'3.3.13','MARKETING',30,'fallback PREST SERV MKT'),
(22,NULL,NULL,'3.3.7','MARKETING',30,'fallback FEIRAS'),
(23,NULL,NULL,'3.2.11','RECURSOS HUMANOS',30,'fallback CONVENÇÕES'),
(24,NULL,NULL,'3.3.3','MARKETING',30,'fallback MATERIAL DIVULGAÇÃO'),
(25,NULL,NULL,'3.2.13.1','RECURSOS HUMANOS',30,'fallback EVENTOS INT'),
(26,NULL,NULL,'3.3.3','MARKETING',30,'fallback BRINDES'),
(27,NULL,NULL,'2.6.2','COMERCIAL',30,'fallback CUSTO VENDAS'),
(28,NULL,NULL,'2.6.2','COMERCIAL',30,'fallback INCENTIVOS'),
(29,NULL,NULL,'2.6.1','COMERCIAL',30,'fallback COMISSÕES'),
(31,NULL,NULL,'3.1.18','ADMINISTRATIVO',30,'fallback REUNIOES/VIAGENS'),
(32,NULL,NULL,'3.4.1','FINANCEIRO',30,'fallback REC FIN'),
(33,NULL,NULL,'3.1.6.2','FISCAL/TRIBUTARIO',30,'fallback IMPOSTOS TAXAS'),
(34,NULL,NULL,'2.2.4','LOGISTICA',30,'fallback EMBALAGENS'),
(35,NULL,NULL,'3.1.23','ADMINISTRATIVO',30,'fallback EVENTUAIS'),
(36,NULL,NULL,'EXCLUIR','FINANCEIRO',30,'fallback CREDITO'),
(37,NULL,NULL,'3.4.1','FINANCEIRO',30,'fallback REC FIN PR'),
(38,NULL,NULL,'2.1.1.3','COMPRAS / CMV',30,'fallback MARCA RUBY'),
(39,NULL,NULL,'3.1.8.4','ADMINISTRATIVO',30,'fallback FREELANCE'),
(41,NULL,NULL,'EXCLUIR','FINANCEIRO',30,'fallback AJUSTE (-)'),
(43,NULL,NULL,'3.4.1','FINANCEIRO',30,'fallback CHEQUE DEV (+)'),
(44,NULL,NULL,'EXCLUIR','FINANCEIRO',30,'fallback AJUSTE (+)'),
(45,NULL,NULL,'4.2.3','LOGISTICA',30,'fallback ATIVO IMOB'),
(46,NULL,NULL,'4.4.2','DIRETORIA/SOCIOS',30,'fallback Dividendos'),
(47,NULL,NULL,'4.4.2','DIRETORIA/SOCIOS',30,'fallback DIVIDENDOS 47'),
(48,NULL,NULL,'4.4.2','DIRETORIA/SOCIOS',30,'fallback DIVIDENDOS 48'),
(49,NULL,NULL,'3.1.11.1','ADMINISTRATIVO',30,'fallback SEGUROS GERAL'),
(51,NULL,NULL,'3.2.13.2','RECURSOS HUMANOS',30,'fallback PREMIAÇÃO FUNC'),
(52,NULL,NULL,'3.3.13','MARKETING',30,'fallback AGÊNCIA MKT IA'),
(53,NULL,NULL,'3.1.9.1','ADMINISTRATIVO',30,'fallback REFORMA'),
(54,NULL,NULL,'3.3.8','MARKETING',30,'fallback DIREITOS AUTORAIS'),
(55,NULL,NULL,'3.3.12','MARKETING',30,'fallback COM VISUAL'),
(57,NULL,NULL,'3.3.5','MARKETING',30,'fallback DISPLAY'),
(58,NULL,NULL,'3.1.8.11','TI',30,'fallback FERRAMENTA FISCAL'),
(59,NULL,NULL,'3.3.13','MARKETING',30,'fallback PRODUTORA AV'),
(60,NULL,NULL,'3.1.18','ADMINISTRATIVO',30,'fallback DESP MKT VIAGEM'),
(61,NULL,NULL,'3.3.2','MARKETING',30,'fallback EVENTOS CORP'),
(62,NULL,NULL,'3.3.2','MARKETING',30,'fallback PRODUÇÃO EVENTOS'),
(63,NULL,NULL,'4.2.8','COMPRAS / CMV',30,'fallback ADIANT FORNEC'),
(108,NULL,NULL,'3.5.1','DIRETORIA/SOCIOS',30,'fallback PRO LABORE'),
(280,NULL,NULL,'4.4.2','DIRETORIA/SOCIOS',30,'fallback DIST LUCRO');

-- 6. Colunas novas
ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS setor_erp_id        integer,
  ADD COLUMN IF NOT EXISTS setor_erp_nome      text,
  ADD COLUMN IF NOT EXISTS departamento_origem text;

ALTER TABLE public.pagamentos_caixa
  ADD COLUMN IF NOT EXISTS departamento_id     uuid REFERENCES public.departamentos(id),
  ADD COLUMN IF NOT EXISTS departamento_origem text,
  ADD COLUMN IF NOT EXISTS tesouraria          boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_departamento ON public.pagamentos_caixa (departamento_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_caixa_tesouraria   ON public.pagamentos_caixa (tesouraria);
CREATE INDEX IF NOT EXISTS idx_cp_setor_erp                  ON public.contas_pagar (setor_erp_id);

-- 7. Funções
CREATE OR REPLACE FUNCTION public.fn_resolve_plano_dre(
  p_ccusto      integer,
  p_historico   integer,
  p_complemento text
)
RETURNS TABLE (plano_contas_id uuid, plano_code text, departamento text, tesouraria boolean, prioridade integer, regra_id bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rule RECORD;
BEGIN
  SELECT m.id, m.plano_code, m.departamento, m.prioridade INTO v_rule
  FROM public.erp_dre_mapa m
  WHERE (m.ccusto_id IS NULL OR m.ccusto_id = p_ccusto)
    AND (m.historico_id IS NULL OR m.historico_id = p_historico)
    AND (m.complemento_like IS NULL OR (p_complemento IS NOT NULL AND p_complemento ILIKE m.complemento_like))
  ORDER BY m.prioridade ASC, m.id ASC LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_rule.plano_code = 'EXCLUIR' THEN
    plano_contas_id := NULL; plano_code := NULL;
    departamento := v_rule.departamento; tesouraria := true;
    prioridade := v_rule.prioridade; regra_id := v_rule.id;
    RETURN NEXT; RETURN;
  END IF;

  SELECT t.id INTO plano_contas_id FROM public.trade_chart_of_accounts t WHERE t.code = v_rule.plano_code LIMIT 1;
  plano_code := v_rule.plano_code; departamento := v_rule.departamento;
  tesouraria := false; prioridade := v_rule.prioridade; regra_id := v_rule.id;
  RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.fn_resolve_depto_dre(
  p_setor integer, p_ccusto integer, p_historico integer
)
RETURNS TABLE (departamento_id uuid, departamento text, origem text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dept text;
BEGIN
  IF p_setor IS NOT NULL AND p_setor > 0 THEN
    SELECT s.departamento INTO v_dept FROM public.erp_setor_depara s WHERE s.setor_id = p_setor LIMIT 1;
    IF v_dept IS NOT NULL THEN
      SELECT v.departamento_id INTO departamento_id FROM public.vw_departamento_canonico v WHERE v.nome_canonico = v_dept LIMIT 1;
      departamento := v_dept; origem := 'setor_erp';
      RETURN NEXT; RETURN;
    END IF;
  END IF;

  SELECT r.departamento INTO v_dept FROM public.fn_resolve_plano_dre(p_ccusto, p_historico, NULL) r;
  IF v_dept IS NULL THEN RETURN; END IF;

  SELECT v.departamento_id INTO departamento_id FROM public.vw_departamento_canonico v WHERE v.nome_canonico = v_dept LIMIT 1;
  departamento := v_dept; origem := 'mapa';
  RETURN NEXT;
END; $$;

GRANT EXECUTE ON FUNCTION public.fn_resolve_plano_dre(integer, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_resolve_depto_dre(integer, integer, integer) TO authenticated, service_role;

COMMENT ON TABLE public.erp_dre_mapa      IS 'De-para ERP → plano de contas curado. Menor prioridade vence.';
COMMENT ON TABLE public.erp_setor_depara  IS 'Setor NATIVO do ERP → departamento canônico.';
COMMENT ON COLUMN public.contas_pagar.departamento_origem IS 'setor_erp | mapa | ia | manual';
COMMENT ON COLUMN public.pagamentos_caixa.departamento_origem IS 'setor_erp | mapa | ia | manual';
