
-- =====================================================================
-- ORÇAMENTO CORPORATIVO — FASE 1
-- =====================================================================

-- 1.1 Taxonomia compartilhada
CREATE TABLE public.orcamento_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  cor text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_categorias TO authenticated;
GRANT ALL ON public.orcamento_categorias TO service_role;
ALTER TABLE public.orcamento_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_categorias_select_authenticated"
  ON public.orcamento_categorias FOR SELECT TO authenticated USING (true);

CREATE POLICY "orcamento_categorias_write_financeiro"
  ON public.orcamento_categorias FOR ALL TO authenticated
  USING (public.is_dept_financeiro(auth.uid()))
  WITH CHECK (public.is_dept_financeiro(auth.uid()));

CREATE TRIGGER trg_orcamento_categorias_updated_at
  BEFORE UPDATE ON public.orcamento_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.orcamento_categorias (nome, ordem) VALUES
  ('Feiras', 10), ('Agências', 20), ('Viagens', 30), ('Marketing', 40),
  ('Materiais', 50), ('Serviços', 60), ('Software', 70), ('Treinamento', 80),
  ('Pessoal', 90), ('Outros', 100)
ON CONFLICT (nome) DO NOTHING;

-- 1.2 budget_periods
CREATE TABLE public.budget_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('mensal','trimestral','semestral','anual')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  valor_total_empresa numeric(14,2) NOT NULL DEFAULT 0,
  status public.budget_period_status NOT NULL DEFAULT 'rascunho',
  criado_por uuid REFERENCES auth.users(id),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_periods TO authenticated;
GRANT ALL ON public.budget_periods TO service_role;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_periods_select_authenticated"
  ON public.budget_periods FOR SELECT TO authenticated USING (true);

CREATE POLICY "budget_periods_write_financeiro"
  ON public.budget_periods FOR ALL TO authenticated
  USING (public.is_dept_financeiro(auth.uid()))
  WITH CHECK (public.is_dept_financeiro(auth.uid()));

CREATE TRIGGER trg_budget_periods_updated_at
  BEFORE UPDATE ON public.budget_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.3 budget_distributions
CREATE TABLE public.budget_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.budget_periods(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departamentos(id) ON DELETE CASCADE,
  valor_alocado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_alocado >= 0),
  valor_reservado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_reservado >= 0),
  status public.budget_distribution_status NOT NULL DEFAULT 'pendente',
  aprovado_por uuid REFERENCES auth.users(id),
  aprovado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, department_id)
);

CREATE INDEX idx_budget_distributions_period ON public.budget_distributions(period_id);
CREATE INDEX idx_budget_distributions_dep ON public.budget_distributions(department_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_distributions TO authenticated;
GRANT ALL ON public.budget_distributions TO service_role;
ALTER TABLE public.budget_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budget_distributions_select_member_or_financeiro"
  ON public.budget_distributions FOR SELECT TO authenticated
  USING (
    public.is_dept_financeiro(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.department_member_roles dmr
      WHERE dmr.department_id = budget_distributions.department_id
        AND dmr.user_id = auth.uid()
    )
  );

CREATE POLICY "budget_distributions_write_financeiro"
  ON public.budget_distributions FOR ALL TO authenticated
  USING (public.is_dept_financeiro(auth.uid()))
  WITH CHECK (public.is_dept_financeiro(auth.uid()));

CREATE TRIGGER trg_budget_distributions_updated_at
  BEFORE UPDATE ON public.budget_distributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1.4 budget_plan_categories
CREATE TABLE public.budget_plan_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid NOT NULL REFERENCES public.budget_distributions(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.orcamento_categorias(id),
  nome text,
  valor_planejado numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_planejado >= 0),
  cor text,
  is_reserva boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bpc_distribution ON public.budget_plan_categories(distribution_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_plan_categories TO authenticated;
GRANT ALL ON public.budget_plan_categories TO service_role;
ALTER TABLE public.budget_plan_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bpc_select_member_or_financeiro"
  ON public.budget_plan_categories FOR SELECT TO authenticated
  USING (
    public.is_dept_financeiro(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.budget_distributions d
      JOIN public.department_member_roles dmr
        ON dmr.department_id = d.department_id
      WHERE d.id = budget_plan_categories.distribution_id
        AND dmr.user_id = auth.uid()
    )
  );

CREATE POLICY "bpc_write_gestor_or_financeiro"
  ON public.budget_plan_categories FOR ALL TO authenticated
  USING (
    public.is_dept_financeiro(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.budget_distributions d
      WHERE d.id = budget_plan_categories.distribution_id
        AND public.has_dept_role(auth.uid(), d.department_id, 'gestor')
    )
  )
  WITH CHECK (
    public.is_dept_financeiro(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.budget_distributions d
      WHERE d.id = budget_plan_categories.distribution_id
        AND public.has_dept_role(auth.uid(), d.department_id, 'gestor')
    )
  );

CREATE TRIGGER trg_bpc_updated_at
  BEFORE UPDATE ON public.budget_plan_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invariante: Σ valor_planejado ≤ valor_alocado da distribution
CREATE OR REPLACE FUNCTION public.trg_validar_plano_vs_alocado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_alocado numeric(14,2);
  v_soma numeric(14,2);
  v_dist_id uuid;
BEGIN
  v_dist_id := COALESCE(NEW.distribution_id, OLD.distribution_id);

  -- Lock na distribution primeiro (ordem distribution -> categorias)
  SELECT valor_alocado INTO v_alocado
    FROM public.budget_distributions
    WHERE id = v_dist_id
    FOR UPDATE;

  IF v_alocado IS NULL THEN
    RAISE EXCEPTION 'Distribuição % não encontrada', v_dist_id;
  END IF;

  SELECT COALESCE(SUM(valor_planejado), 0) INTO v_soma
    FROM public.budget_plan_categories
    WHERE distribution_id = v_dist_id
      AND (TG_OP <> 'UPDATE' OR id <> NEW.id);

  IF TG_OP IN ('INSERT','UPDATE') THEN
    v_soma := v_soma + COALESCE(NEW.valor_planejado, 0);
  END IF;

  IF v_soma > v_alocado THEN
    RAISE EXCEPTION 'Soma do plano (R$ %) excede o valor alocado (R$ %)', v_soma, v_alocado
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_bpc_validar_plano
  BEFORE INSERT OR UPDATE OR DELETE ON public.budget_plan_categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_validar_plano_vs_alocado();

-- 1.5 Extensão opt-in
ALTER TABLE public.department_budgets
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.budget_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distribution_id uuid REFERENCES public.budget_distributions(id) ON DELETE SET NULL;

ALTER TABLE public.department_expenses
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.budget_periods(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distribution_id uuid REFERENCES public.budget_distributions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_category_id uuid REFERENCES public.budget_plan_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dept_expenses_distribution ON public.department_expenses(distribution_id);

-- 1.6 View de KPIs com security_invoker
CREATE VIEW public.vw_budget_distribution_kpis
WITH (security_invoker = on) AS
SELECT
  d.id                              AS distribution_id,
  d.period_id,
  d.department_id,
  d.valor_alocado,
  COALESCE(p.valor_planejado, 0)    AS valor_planejado,
  COALESCE(p.saldo_reservado, 0)    AS saldo_reservado,
  0::numeric                        AS valor_comprometido,
  COALESCE(e.valor_utilizado, 0)    AS valor_utilizado,
  COALESCE(e.valor_pago, 0)         AS valor_pago,
  (d.valor_alocado
    - 0
    - COALESCE(e.valor_utilizado, 0)) AS saldo_livre
FROM public.budget_distributions d
LEFT JOIN LATERAL (
  SELECT
    SUM(valor_planejado)                                AS valor_planejado,
    SUM(valor_planejado) FILTER (WHERE is_reserva)      AS saldo_reservado
  FROM public.budget_plan_categories
  WHERE distribution_id = d.id
) p ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(valor_realizado, valor_previsto, 0))
      FILTER (WHERE status IN ('approved','pending_financial','paid'))  AS valor_utilizado,
    SUM(COALESCE(valor_realizado, valor_previsto, 0))
      FILTER (WHERE status = 'paid')                                    AS valor_pago
  FROM public.department_expenses
  WHERE distribution_id = d.id
) e ON true;

GRANT SELECT ON public.vw_budget_distribution_kpis TO authenticated;

-- 1.7 RPCs
CREATE OR REPLACE FUNCTION public.rpc_criar_periodo_orcamentario(
  p_nome text,
  p_tipo text,
  p_data_inicio date,
  p_data_fim date,
  p_valor_total_empresa numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_dept_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o Financeiro pode criar períodos orçamentários'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_tipo NOT IN ('mensal','trimestral','semestral','anual') THEN
    RAISE EXCEPTION 'Tipo de período inválido: %', p_tipo;
  END IF;

  IF p_valor_total_empresa < 0 THEN
    RAISE EXCEPTION 'Valor total da empresa não pode ser negativo';
  END IF;

  INSERT INTO public.budget_periods (nome, tipo, data_inicio, data_fim, valor_total_empresa, criado_por)
  VALUES (p_nome, p_tipo, p_data_inicio, p_data_fim, p_valor_total_empresa, auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_periodo_orcamentario(text, text, date, date, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_criar_periodo_orcamentario(text, text, date, date, numeric) TO authenticated;

-- rpc_distribuir_verba
-- Ordem de lock: budget_periods -> budget_distributions (DO UPDATE) -> budget_plan_categories
-- IGUAL ao trigger trg_bpc_validar_plano. NÃO inverter — risco de deadlock entre
-- financeiro baixando alocação e gestor editando o plano em paralelo.
CREATE OR REPLACE FUNCTION public.rpc_distribuir_verba(
  p_period_id uuid,
  p_alocacoes jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teto numeric(14,2);
  v_soma numeric(14,2) := 0;
  v_item jsonb;
  v_dep uuid;
  v_valor numeric(14,2);
  v_dist_id uuid;
  v_planejado numeric(14,2);
BEGIN
  IF NOT public.is_dept_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o Financeiro pode distribuir verba'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Passo 1: lock no período
  SELECT valor_total_empresa INTO v_teto
    FROM public.budget_periods
    WHERE id = p_period_id
    FOR UPDATE;

  IF v_teto IS NULL THEN
    RAISE EXCEPTION 'Período % não encontrado', p_period_id;
  END IF;

  -- Passo 2: somar
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alocacoes)
  LOOP
    v_valor := COALESCE((v_item->>'valor')::numeric, 0);
    IF v_valor < 0 THEN
      RAISE EXCEPTION 'Valor negativo não permitido';
    END IF;
    v_soma := v_soma + v_valor;
  END LOOP;

  IF v_soma > v_teto THEN
    RAISE EXCEPTION 'Soma da distribuição (R$ %) excede o teto da empresa (R$ %)', v_soma, v_teto
      USING ERRCODE = 'check_violation';
  END IF;

  -- Passo 3+4: upsert por departamento, travando a distribution e validando contra o planejado
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_alocacoes)
  LOOP
    v_dep := (v_item->>'department_id')::uuid;
    v_valor := COALESCE((v_item->>'valor')::numeric, 0);

    -- Passo 3: UPSERT que TRAVA a linha da distribution
    INSERT INTO public.budget_distributions
      (period_id, department_id, valor_alocado, status, aprovado_por, aprovado_em)
    VALUES
      (p_period_id, v_dep, v_valor, 'aprovada', auth.uid(), now())
    ON CONFLICT (period_id, department_id) DO UPDATE
      SET valor_alocado = EXCLUDED.valor_alocado,
          status        = 'aprovada',
          aprovado_por  = auth.uid(),
          aprovado_em   = now()
    RETURNING id INTO v_dist_id;

    -- Passo 4: após travar a distribution, conferir contra o plano já existente
    SELECT COALESCE(SUM(valor_planejado), 0) INTO v_planejado
      FROM public.budget_plan_categories
      WHERE distribution_id = v_dist_id
      FOR UPDATE;

    IF v_valor < v_planejado THEN
      RAISE EXCEPTION
        'Não é possível alocar R$ % ao departamento %: já há R$ % planejados em categorias',
        v_valor, v_dep, v_planejado
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_distribuir_verba(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_distribuir_verba(uuid, jsonb) TO authenticated;

-- rpc_atribuir_perfil_departamento
CREATE OR REPLACE FUNCTION public.rpc_atribuir_perfil_departamento(
  p_department_id uuid,
  p_user_id uuid,
  p_perfil public.dept_member_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_is_first_gestor boolean;
BEGIN
  IF NOT (
    public.has_dept_role(auth.uid(), p_department_id, 'gestor')
    OR public.is_dept_financeiro(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para atribuir perfis neste departamento'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_perfil = 'financeiro'
     AND NOT (public.is_dept_financeiro(auth.uid())
              OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Apenas Financeiro ou Admin podem atribuir o perfil financeiro'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.department_member_roles (department_id, user_id, perfil, created_by)
  VALUES (p_department_id, p_user_id, p_perfil, auth.uid())
  ON CONFLICT (department_id, user_id, perfil) DO UPDATE
    SET created_by = COALESCE(public.department_member_roles.created_by, EXCLUDED.created_by)
  RETURNING id INTO v_id;

  IF p_perfil = 'gestor' THEN
    SELECT (responsavel_id IS NULL) INTO v_is_first_gestor
      FROM public.departamentos WHERE id = p_department_id;

    IF v_is_first_gestor THEN
      UPDATE public.departamentos
        SET responsavel_id = p_user_id
        WHERE id = p_department_id AND responsavel_id IS NULL;
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_atribuir_perfil_departamento(uuid, uuid, public.dept_member_role) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_atribuir_perfil_departamento(uuid, uuid, public.dept_member_role) TO authenticated;

-- 1.8 Catálogo de telas
-- O enum app_role não contém 'financeiro' (esse é um perfil de departamento).
-- Acesso efetivo é regido pelas RLS das tabelas; aqui só registramos as telas
-- com acesso_padrao=true para que o ScreenProtectedRoute não bloqueie.
INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, ordem, ativo, acesso_padrao)
VALUES
  ('orcamento_periodos',    'Orçamento — Períodos',     'Períodos orçamentários da empresa',         '/dashboard/orcamento', 110, true, true),
  ('orcamento_distribuicao','Orçamento — Distribuição', 'Distribuição de verba por departamento',    '/dashboard/orcamento', 120, true, true),
  ('orcamento_plano',       'Orçamento — Plano',        'Plano de categorias do departamento',       '/dashboard/orcamento', 130, true, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT 'admin'::public.app_role, t.id
FROM public.telas_sistema t
WHERE t.codigo IN ('orcamento_periodos','orcamento_distribuicao','orcamento_plano')
ON CONFLICT (role, tela_id) DO NOTHING;

INSERT INTO public.ui_permissions (role, tela_codigo, componente_codigo, visivel, editavel)
VALUES
  ('admin','orcamento_periodos','btn_criar_periodo', true, true),
  ('admin','orcamento_distribuicao','btn_distribuir_verba', true, true)
ON CONFLICT (role, departamento_id, tela_codigo, componente_codigo) DO NOTHING;
