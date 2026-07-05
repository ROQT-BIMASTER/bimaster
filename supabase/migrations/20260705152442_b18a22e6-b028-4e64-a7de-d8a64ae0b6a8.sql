-- =====================================================================
-- TORRE DE DESPESAS · FASE 2 — DDL
-- =====================================================================

-- 2.1 Catálogo de regras: parametrização sem redeploy
CREATE TABLE IF NOT EXISTS public.despesa_regras (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  severidade_default text NOT NULL CHECK (severidade_default IN ('critica','alta','media','baixa')),
  params jsonb NOT NULL DEFAULT '{}',
  cadencia text NOT NULL DEFAULT 'diaria' CHECK (cadencia IN ('diaria','semanal','mensal')),
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Alertas
CREATE TABLE IF NOT EXISTS public.despesa_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_codigo text NOT NULL REFERENCES public.despesa_regras(codigo),
  chave_dedup text NOT NULL,
  severidade text NOT NULL CHECK (severidade IN ('critica','alta','media','baixa')),
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo','em_analise','acionado','resolvido','descartado')),
  origem text NOT NULL DEFAULT 'deterministico' CHECK (origem IN ('deterministico','manual')),
  titulo text NOT NULL,
  descricao text,
  score numeric,
  valor_impacto numeric(14,2),
  empresa_id integer,
  departamento_id uuid REFERENCES public.departamentos(id),
  plano_contas_id uuid REFERENCES public.trade_chart_of_accounts(id),
  centro_custo_id uuid,
  fornecedor_codigo text,
  fornecedor_nome text,
  competencia date,
  conta_ids uuid[] DEFAULT '{}',
  evidencia jsonb NOT NULL DEFAULT '{}',
  primeiro_detectado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_detectado_em timestamptz NOT NULL DEFAULT now(),
  ocorrencias int NOT NULL DEFAULT 1,
  reaberto_count int NOT NULL DEFAULT 0,
  revisao_id uuid REFERENCES public.contas_pagar_revisao(id),
  atribuido_a uuid,
  resolvido_por uuid,
  resolvido_em timestamptz,
  resolucao_nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regra_codigo, chave_dedup)
);

CREATE INDEX IF NOT EXISTS idx_despesa_alertas_abertos
  ON public.despesa_alertas (severidade, valor_impacto DESC)
  WHERE status IN ('novo','em_analise');
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_dept
  ON public.despesa_alertas (departamento_id, status);
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_forn
  ON public.despesa_alertas (fornecedor_codigo);

-- 2.3 Eventos
CREATE TABLE IF NOT EXISTS public.despesa_alertas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES public.despesa_alertas(id) ON DELETE CASCADE,
  de_status text,
  para_status text,
  usuario_id uuid,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_eventos_alerta
  ON public.despesa_alertas_eventos (alerta_id, created_at);

-- 2.4 Snapshot
CREATE TABLE IF NOT EXISTS public.despesa_cp_snapshot (
  erp_id text NOT NULL,
  mes_ref date NOT NULL,
  natureza_lancamento text,
  valor_original numeric,
  valor_pago numeric,
  PRIMARY KEY (erp_id, mes_ref)
);

-- 2.5 Índices auxiliares em contas_pagar
CREATE INDEX IF NOT EXISTS idx_cp_emissao_ativo
  ON public.contas_pagar (data_emissao) WHERE status <> 'cancelado';
CREATE INDEX IF NOT EXISTS idx_cp_forn_emissao
  ON public.contas_pagar (fornecedor_codigo, data_emissao);

-- =====================================================================
-- RLS + GRANTs
-- =====================================================================
ALTER TABLE public.despesa_regras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_alertas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_alertas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_cp_snapshot     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.despesa_regras,
              public.despesa_alertas,
              public.despesa_alertas_eventos,
              public.despesa_cp_snapshot
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.despesa_regras,
                public.despesa_alertas,
                public.despesa_alertas_eventos
  TO authenticated;
GRANT ALL ON public.despesa_regras,
             public.despesa_alertas,
             public.despesa_alertas_eventos,
             public.despesa_cp_snapshot
  TO service_role;

DROP POLICY IF EXISTS despesa_regras_sel ON public.despesa_regras;
CREATE POLICY despesa_regras_sel ON public.despesa_regras
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

DROP POLICY IF EXISTS despesa_alertas_sel ON public.despesa_alertas;
CREATE POLICY despesa_alertas_sel ON public.despesa_alertas
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'financeiro')
    AND public.is_admin_or_supervisor(auth.uid())
  );

DROP POLICY IF EXISTS despesa_alertas_eventos_sel ON public.despesa_alertas_eventos;
CREATE POLICY despesa_alertas_eventos_sel ON public.despesa_alertas_eventos
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'financeiro')
    AND public.is_admin_or_supervisor(auth.uid())
  );

-- =====================================================================
-- SEED de regras (idempotente)
-- =====================================================================
INSERT INTO public.despesa_regras (codigo, nome, descricao, severidade_default, params, cadencia, ativo) VALUES
('R01_ZSCORE_MOM_YOY',
 'Salto anômalo por departamento × plano (z-score / MoM / YoY)',
 'Gasto do mês fora do padrão de 12 meses (z-score) ou explosão YoY, por departamento × plano de contas.',
 'alta',
 '{"z_alta":3,"z_media":2,"yoy_alta_pct":100,"piso_valor":10000,"n_meses_min":6,"conf_minima":0.7}'::jsonb,
 'diaria', true),
('R02_FORNECEDOR_NOVO_VOLUME',
 'Fornecedor novo com volume alto',
 'Fornecedor com 1ª emissão nos últimos 90 dias já acumulando volume material (shell company / billing scheme).',
 'alta',
 '{"janela_dias":90,"piso_acumulado":50000,"piso_titulo":30000,"piso_critico":200000,"piso_materialidade":5000}'::jsonb,
 'diaria', true),
('R03_DUPLICIDADE',
 'Duplicidade de título',
 'Mesmo fornecedor+empresa, valor ±tolerância, janela curta, erp_id distinto, excluindo parcelamento legítimo.',
 'alta',
 '{"janela_dias":7,"tolerancia_pct":0.01,"piso_valor":500}'::jsonb,
 'diaria', true),
('R04_FRACIONAMENTO',
 'Fracionamento para escapar de alçada',
 '>=N títulos do fornecedor no período, todos abaixo da alçada, somando >=mult×alçada, com fatias parelhas (CV baixo).',
 'alta',
 '{"piso_valor":10000,"min_titulos":3,"mult_soma":1.2,"janela":"dia","cv_max":0.25,"piso_materialidade":0,"whitelist_planos":[]}'::jsonb,
 'diaria', true),
('R06_CONCENTRACAO_FORNECEDOR',
 'Concentração de fornecedor no departamento',
 'Fornecedor >=40% do gasto do departamento (piso R$30k/90d) e crescendo >=10 p.p. YoY (conluio / kickback).',
 'media',
 '{"share_min":0.40,"share_alta":0.60,"piso_valor":30000,"janela_dias":90,"delta_pp_min":0.10,"meses_casa_alta":24,"excluir_admin_baixa_conf":true}'::jsonb,
 'semanal', true),
('R07_LANCAMENTO_NAO_UTIL',
 'Emissão em dia não útil',
 'Título emitido em sábado/domingo/feriado, acima do piso, excluindo tipos operacionais (fator de baixa severidade).',
 'baixa',
 '{"piso_valor":5000,"excluir_tipos":["BOLETO","TARIFA","IMPOSTO"],"conf_min_admin":0.70}'::jsonb,
 'diaria', true),
('R08_BENFORD',
 'Distribuição de 1º dígito atípica (Benford)',
 'Teste de Benford (χ² 8 g.l., p<0,01) por departamento/fornecedor por semestre (direcionador forense, nunca prova).',
 'media',
 '{"qui2_critico":20.09,"min_amostra_dept":300,"min_amostra_forn":100,"piso_valor":0,"meses_janela":6}'::jsonb,
 'semanal', true),
('R09_PROVISAO_ENGORDA',
 'Provisão que engorda ao ser lançada',
 'Título que transitou provisionado->lancado e teve valor_original elevado após a transição (via histórico).',
 'alta',
 '{"pct_engorda":0.05,"piso_valor":500}'::jsonb,
 'diaria', true),
('R11_JUROS_CRONICOS',
 'Juros/acréscimos crônicos por fornecedor',
 '>=3 títulos com juros >2% e >=R$2k somados, OU >=3 pagos >105% do original, em 6 meses.',
 'media',
 '{"janela_meses":6,"min_titulos":3,"pct_juros_min":0.02,"piso_juros_soma":2000,"ratio_pago_min":1.05,"piso_valor":2000}'::jsonb,
 'semanal', true),
('R12_PORTADOR_ATIPICO',
 'Portador atípico do fornecedor',
 'Título roteado por portador != do habitual do fornecedor NA MESMA EMPRESA (>=6 pagamentos históricos), acima do piso.',
 'media',
 '{"piso_valor":5000,"min_pagamentos":6,"supressao_troca_banco_pct":0.30}'::jsonb,
 'diaria', true),
('R13_DOUBLE_DIPPING_INTRAGRUPO',
 'Mesmo documento em múltiplos CNPJs',
 'Mesmo numero_documento+valor+fornecedor em >=min_cnpjs empresas do grupo (double-dipping intragrupo).',
 'alta',
 '{"piso_valor":5000,"min_cnpjs":2}'::jsonb,
 'diaria', true),
('R14_SENTINELAS',
 'Sentinelas de higiene forense',
 'Quitado sem data_pagamento, pgto<emissão, venc<emissão, aberto<0, pago com aberto>0 (monitor do gap ①).',
 'baixa',
 '{"piso_valor":5000,"tolerancia_aberto":1.00}'::jsonb,
 'diaria', true),
('R15_FORNECEDOR_QUASE_DUPLICADO',
 'Fornecedor quase-duplicado',
 'Nome normalizado igual ou similarity()>limiar (pg_trgm) sob códigos distintos (dupla cobrança que escapa do R03).',
 'media',
 '{"limiar_similaridade":0.90,"piso_valor":30000,"janela_meses":12,"min_len_nome":6}'::jsonb,
 'semanal', true)
ON CONFLICT (codigo) DO NOTHING;

-- =====================================================================
-- Transição de alerta (RPC segura)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.fn_despesas_alerta_transicao(
  p_alerta_id     uuid,
  p_novo_status   text,
  p_justificativa text DEFAULT NULL,
  p_revisao_id    uuid DEFAULT NULL
)
RETURNS public.despesa_alertas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alerta public.despesa_alertas;
  v_before jsonb;
  v_after  jsonb;
  v_ok     boolean := false;
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta FROM public.despesa_alertas WHERE id = p_alerta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alerta % nao encontrado', p_alerta_id USING ERRCODE = 'P0002';
  END IF;

  v_ok := CASE
    WHEN v_alerta.status = 'novo'       AND p_novo_status IN ('em_analise','descartado')            THEN true
    WHEN v_alerta.status = 'em_analise' AND p_novo_status IN ('acionado','descartado')              THEN true
    WHEN v_alerta.status = 'acionado'   AND p_novo_status IN ('resolvido','descartado')             THEN true
    ELSE false
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'transicao invalida: % -> %', v_alerta.status, p_novo_status USING ERRCODE = '22023';
  END IF;

  IF p_novo_status IN ('descartado','resolvido')
     AND (p_justificativa IS NULL OR btrim(p_justificativa) = '') THEN
    RAISE EXCEPTION 'justificativa obrigatoria para % de um alerta', p_novo_status USING ERRCODE = '22023';
  END IF;

  IF p_novo_status = 'acionado' AND p_revisao_id IS NULL AND v_alerta.revisao_id IS NULL THEN
    RAISE EXCEPTION 'acionar exige revisao_id (crie a revisao via MarcarRevisaoDialog antes)' USING ERRCODE = '22023';
  END IF;

  v_before := to_jsonb(v_alerta);

  UPDATE public.despesa_alertas SET
    status        = p_novo_status,
    revisao_id    = COALESCE(p_revisao_id, revisao_id),
    atribuido_a   = CASE WHEN p_novo_status = 'em_analise' THEN COALESCE(atribuido_a, auth.uid()) ELSE atribuido_a END,
    resolvido_por = CASE WHEN p_novo_status IN ('resolvido','descartado') THEN auth.uid() ELSE resolvido_por END,
    resolvido_em  = CASE WHEN p_novo_status IN ('resolvido','descartado') THEN now() ELSE resolvido_em END,
    resolucao_nota= CASE WHEN p_novo_status IN ('resolvido','descartado') THEN p_justificativa ELSE resolucao_nota END,
    updated_at    = now()
  WHERE id = p_alerta_id
  RETURNING * INTO v_alerta;

  v_after := to_jsonb(v_alerta);

  INSERT INTO public.despesa_alertas_eventos (alerta_id, de_status, para_status, usuario_id, nota)
  VALUES (p_alerta_id, (v_before->>'status'), p_novo_status, auth.uid(), p_justificativa);

  PERFORM public.audit_log_record(
    'despesa_alerta.' || p_novo_status,
    'despesa_alertas',
    p_alerta_id::text,
    v_before,
    v_after
  );

  RETURN v_alerta;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesas_alerta_transicao(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_despesas_alerta_transicao(uuid, text, text, uuid) TO authenticated, service_role;

-- =====================================================================
-- ALTER CHECK tipo_revisao (inclui 'auditar')
-- =====================================================================
ALTER TABLE public.contas_pagar_revisao
  DROP CONSTRAINT IF EXISTS contas_pagar_revisao_tipo_revisao_check;
ALTER TABLE public.contas_pagar_revisao
  ADD CONSTRAINT contas_pagar_revisao_tipo_revisao_check
  CHECK (tipo_revisao IN ('eliminar','reduzir','renegociar','monitorar','auditar'));
