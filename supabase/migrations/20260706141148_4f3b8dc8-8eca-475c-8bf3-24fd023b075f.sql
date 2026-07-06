
-- ============================================================================
-- F3 - Alertas de estouro (R10) + suplementação de verba com trilha
-- ============================================================================

-- 1a. Registrar regra R10_ORCAMENTO_DEGRAU
INSERT INTO public.despesa_regras (codigo, nome, descricao, severidade_default, params, cadencia, ativo)
VALUES (
  'R10_ORCAMENTO_DEGRAU',
  'Estouro de orçamento por departamento',
  'Consumo da verba do departamento cruzou degrau 80/95/100% no período ativo',
  'alta',
  '{}'::jsonb,
  'diaria',
  true
)
ON CONFLICT (codigo) DO UPDATE
SET nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    severidade_default = EXCLUDED.severidade_default,
    cadencia = EXCLUDED.cadencia,
    ativo = EXCLUDED.ativo,
    updated_at = now();

-- 1b. Função de detecção R10 (standalone; wiring no dispatcher é opcional/futuro)
CREATE OR REPLACE FUNCTION public.fn_despesa_detectar_r10_orcamento()
RETURNS TABLE(inseridos int, atualizados int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ativa boolean;
  v_sev_default text;
  v_ins int := 0;
  v_upd int := 0;
  v_rec record;
  v_dept_nome text;
  v_severidade text;
  v_chave text;
  v_titulo text;
  v_existed boolean;
BEGIN
  SELECT ativo, severidade_default INTO v_ativa, v_sev_default
  FROM public.despesa_regras WHERE codigo = 'R10_ORCAMENTO_DEGRAU';
  IF NOT COALESCE(v_ativa, false) THEN
    inseridos := 0; atualizados := 0; RETURN NEXT; RETURN;
  END IF;

  FOR v_rec IN
    SELECT p.id AS period_id, p.nome AS period_nome, p.status::text AS period_status,
           s.department_id, s.valor_alocado, s.valor_comprometido, s.valor_utilizado,
           s.pct_consumido, s.estagio
    FROM public.budget_periods p
    CROSS JOIN LATERAL public.fn_orcamento_saldos(p.id) s
    WHERE (p.status::text = 'ativo'
           OR (p.status::text <> 'ativo'
               AND current_date BETWEEN p.data_inicio AND p.data_fim))
      AND s.distribution_id IS NOT NULL
      AND s.department_id IS NOT NULL
      AND s.estagio <> 'ok'
  LOOP
    v_severidade := CASE v_rec.estagio
      WHEN 'alerta_80'      THEN 'media'
      WHEN 'critico_95'     THEN 'alta'
      WHEN 'estourado_100'  THEN 'critica'
      ELSE COALESCE(v_sev_default, 'alta')
    END;

    v_chave := 'R10|' || v_rec.period_id::text || '|' || v_rec.department_id::text || '|' || v_rec.estagio;

    SELECT nome INTO v_dept_nome FROM public.departamentos WHERE id = v_rec.department_id;

    v_titulo := 'Orçamento ' || COALESCE(v_dept_nome, 'departamento')
                || ' — ' || CASE v_rec.estagio
                              WHEN 'alerta_80'     THEN 'atingiu 80%'
                              WHEN 'critico_95'    THEN 'atingiu 95%'
                              WHEN 'estourado_100' THEN 'estourou 100%'
                              ELSE v_rec.estagio END
                || ' (' || v_rec.period_nome || ')';

    SELECT true INTO v_existed FROM public.despesa_alertas WHERE chave_dedup = v_chave;

    INSERT INTO public.despesa_alertas (
      regra_codigo, chave_dedup, severidade, status, origem,
      titulo, descricao, departamento_id, valor_impacto,
      evidencia, primeiro_detectado_em, ultimo_detectado_em, ocorrencias
    ) VALUES (
      'R10_ORCAMENTO_DEGRAU',
      v_chave,
      v_severidade,
      'novo',
      'auto',
      v_titulo,
      'Detecção automática (R10) — consumo agregado cruzou degrau configurado.',
      v_rec.department_id,
      GREATEST(v_rec.valor_comprometido + v_rec.valor_utilizado - v_rec.valor_alocado, 0),
      jsonb_build_object(
        'period_id', v_rec.period_id,
        'period_nome', v_rec.period_nome,
        'valor_alocado', v_rec.valor_alocado,
        'valor_comprometido', v_rec.valor_comprometido,
        'valor_utilizado', v_rec.valor_utilizado,
        'pct_consumido', v_rec.pct_consumido,
        'estagio', v_rec.estagio
      ),
      now(), now(), 1
    )
    ON CONFLICT (chave_dedup) DO UPDATE
      SET ultimo_detectado_em = now(),
          ocorrencias = public.despesa_alertas.ocorrencias + 1,
          severidade = EXCLUDED.severidade,
          evidencia = EXCLUDED.evidencia,
          valor_impacto = EXCLUDED.valor_impacto,
          updated_at = now();

    IF COALESCE(v_existed, false) THEN
      v_upd := v_upd + 1;
    ELSE
      v_ins := v_ins + 1;
    END IF;
  END LOOP;

  inseridos := v_ins; atualizados := v_upd; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_despesa_detectar_r10_orcamento() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_despesa_detectar_r10_orcamento() TO authenticated, service_role;

-- ============================================================================
-- 1d. Tabela budget_suplementacoes
-- ============================================================================
CREATE TABLE public.budget_suplementacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.budget_distributions(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id),
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  justificativa text NOT NULL CHECK (length(trim(justificativa)) >= 5),
  alerta_id uuid REFERENCES public.despesa_alertas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovada','rejeitada')),
  decisor_id uuid REFERENCES auth.users(id),
  decidido_em timestamptz,
  motivo_decisao text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_suplementacoes_distribution ON public.budget_suplementacoes(distribution_id);
CREATE INDEX idx_budget_suplementacoes_status ON public.budget_suplementacoes(status);
CREATE INDEX idx_budget_suplementacoes_solicitante ON public.budget_suplementacoes(solicitante_id);

GRANT SELECT ON public.budget_suplementacoes TO authenticated;
GRANT ALL ON public.budget_suplementacoes TO service_role;

ALTER TABLE public.budget_suplementacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: gestor do depto da distribuição, financeiro, ou admin
CREATE POLICY "sup_select_visibility"
ON public.budget_suplementacoes
FOR SELECT
TO authenticated
USING (
  public.is_dept_financeiro(auth.uid())
  OR public.check_user_access(auth.uid(), 'financeiro')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.budget_distributions d
    WHERE d.id = budget_suplementacoes.distribution_id
      AND public.has_dept_role(auth.uid(), d.department_id, 'gestor'::dept_member_role)
  )
);

-- Escrita direta bloqueada (RPC-only)
CREATE POLICY "sup_no_direct_write"
ON public.budget_suplementacoes
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.tg_budget_suplementacoes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_budget_suplementacoes_updated_at
BEFORE UPDATE ON public.budget_suplementacoes
FOR EACH ROW EXECUTE FUNCTION public.tg_budget_suplementacoes_updated_at();

-- ============================================================================
-- 1e. RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_solicitar_suplementacao(
  p_distribution_id uuid,
  p_valor numeric,
  p_justificativa text,
  p_alerta_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_dept uuid;
  v_period uuid;
  v_period_nome text;
  v_dept_nome text;
  v_id uuid;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'valor deve ser maior que zero';
  END IF;
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'justificativa obrigatória (mínimo 5 caracteres)';
  END IF;

  SELECT d.department_id, d.period_id INTO v_dept, v_period
  FROM public.budget_distributions d
  WHERE d.id = p_distribution_id;

  IF v_dept IS NULL THEN
    RAISE EXCEPTION 'distribuição não encontrada';
  END IF;

  v_autorizado :=
       public.has_dept_role(v_uid, v_dept, 'gestor'::dept_member_role)
    OR public.is_dept_financeiro(v_uid)
    OR public.check_user_access(v_uid, 'financeiro')
    OR public.has_role(v_uid, 'admin'::app_role);

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'sem permissão para solicitar suplementação neste departamento';
  END IF;

  INSERT INTO public.budget_suplementacoes (
    distribution_id, solicitante_id, valor, justificativa, alerta_id, status
  ) VALUES (
    p_distribution_id, v_uid, p_valor, p_justificativa, p_alerta_id, 'pendente'
  )
  RETURNING id INTO v_id;

  SELECT nome INTO v_period_nome FROM public.budget_periods WHERE id = v_period;
  SELECT nome INTO v_dept_nome FROM public.departamentos WHERE id = v_dept;

  -- Notifica financeiros/admins
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT DISTINCT ur.user_id,
         'suplementacao_solicitada',
         'Nova solicitação de suplementação',
         'Departamento ' || COALESCE(v_dept_nome, '—')
           || ' solicitou R$ ' || to_char(p_valor, 'FM999G999G999D00')
           || ' em ' || COALESCE(v_period_nome, 'período atual'),
         '/dashboard/orcamento?tab=consumo&suplementacao=' || v_id::text
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'financeiro'::app_role);

  -- Trilha imutável
  INSERT INTO public.audit_log_immutable (actor_id, action, entity, entity_id, after_data)
  VALUES (
    v_uid,
    'suplementacao.solicitada',
    'budget_suplementacoes',
    v_id::text,
    jsonb_build_object(
      'distribution_id', p_distribution_id,
      'department_id', v_dept,
      'period_id', v_period,
      'valor', p_valor,
      'justificativa', p_justificativa,
      'alerta_id', p_alerta_id
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_solicitar_suplementacao(uuid, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_solicitar_suplementacao(uuid, numeric, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_decidir_suplementacao(
  p_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sup record;
  v_dist record;
  v_soma_alocado numeric;
  v_teto numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  IF NOT (public.is_dept_financeiro(v_uid)
          OR public.check_user_access(v_uid, 'financeiro')
          OR public.has_role(v_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'apenas financeiro/admin pode decidir suplementações';
  END IF;

  -- Lock a linha da suplementação separado da agregação (evita 0A000)
  SELECT * INTO v_sup FROM public.budget_suplementacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suplementação não encontrada';
  END IF;
  IF v_sup.status <> 'pendente' THEN
    RAISE EXCEPTION 'suplementação já foi decidida';
  END IF;

  IF NOT p_aprovar THEN
    IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
      RAISE EXCEPTION 'motivo obrigatório para rejeitar';
    END IF;
    UPDATE public.budget_suplementacoes
       SET status='rejeitada', decisor_id=v_uid, decidido_em=now(), motivo_decisao=p_motivo
     WHERE id=p_id;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_sup.solicitante_id, 'suplementacao_rejeitada',
            'Suplementação rejeitada',
            'Motivo: ' || p_motivo,
            '/dashboard/orcamento?tab=consumo&suplementacao=' || p_id::text);

    INSERT INTO public.audit_log_immutable (actor_id, action, entity, entity_id, after_data)
    VALUES (v_uid, 'suplementacao.decidida', 'budget_suplementacoes', p_id::text,
            jsonb_build_object('decisao','rejeitada','motivo',p_motivo));
    RETURN;
  END IF;

  -- Aprovar: valida teto do período
  SELECT * INTO v_dist FROM public.budget_distributions WHERE id = v_sup.distribution_id;

  SELECT COALESCE(sum(valor_alocado), 0) INTO v_soma_alocado
  FROM public.budget_distributions
  WHERE period_id = v_dist.period_id;

  SELECT valor_total_empresa INTO v_teto
  FROM public.budget_periods WHERE id = v_dist.period_id;

  IF v_teto IS NOT NULL AND (v_soma_alocado + v_sup.valor) > v_teto THEN
    RAISE EXCEPTION 'suplementação excede teto do período; ajuste o teto antes (atual: %, teto: %)',
      (v_soma_alocado + v_sup.valor), v_teto;
  END IF;

  UPDATE public.budget_distributions
     SET valor_alocado = valor_alocado + v_sup.valor
   WHERE id = v_sup.distribution_id;

  UPDATE public.budget_suplementacoes
     SET status='aprovada', decisor_id=v_uid, decidido_em=now(), motivo_decisao=p_motivo
   WHERE id=p_id;

  -- Se veio de alerta, transiciona para 'acionado'
  IF v_sup.alerta_id IS NOT NULL THEN
    BEGIN
      PERFORM public.fn_despesas_alerta_transicao(v_sup.alerta_id, 'acionado', 'suplementação aprovada');
    EXCEPTION WHEN OTHERS THEN
      -- transição pode falhar se status atual não permite; não bloqueia aprovação
      NULL;
    END;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (v_sup.solicitante_id, 'suplementacao_aprovada',
          'Suplementação aprovada',
          'Sua solicitação de R$ ' || to_char(v_sup.valor, 'FM999G999G999D00') || ' foi aprovada.',
          '/dashboard/orcamento?tab=consumo&suplementacao=' || p_id::text);

  INSERT INTO public.audit_log_immutable (actor_id, action, entity, entity_id, after_data)
  VALUES (v_uid, 'suplementacao.decidida', 'budget_suplementacoes', p_id::text,
          jsonb_build_object(
            'decisao','aprovada',
            'valor', v_sup.valor,
            'distribution_id', v_sup.distribution_id,
            'motivo', p_motivo
          ));
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_decidir_suplementacao(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_decidir_suplementacao(uuid, boolean, text) TO authenticated;
