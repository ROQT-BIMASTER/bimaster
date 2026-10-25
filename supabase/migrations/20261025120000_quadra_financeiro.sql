-- =============================================================================
-- Módulo Quadra de Futebol — controle financeiro
--   • quadra_mensalistas : clientes com horário fixo e mensalidade
--   • quadra_reservas    : aluguéis avulsos de horário (geram receita)
--   • quadra_lancamentos : livro-caixa (receitas e despesas)
--   • RPC quadra_gerar_mensalidades(competencia) : cobra mensalistas ativos
--   • Registro do módulo `quadra`, tela `quadra_financeiro` e menu lateral
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Mensalistas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quadra_mensalistas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL CHECK (char_length(nome) BETWEEN 2 AND 120),
  telefone        text,
  email           text,
  dia_semana      smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio  time NOT NULL,
  horario_fim     time NOT NULL,
  valor_mensal    numeric(12,2) NOT NULL CHECK (valor_mensal >= 0),
  dia_vencimento  smallint NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  ativo           boolean NOT NULL DEFAULT true,
  observacoes     text,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quadra_mensalistas_horario_ck CHECK (horario_fim > horario_inicio)
);

CREATE INDEX IF NOT EXISTS idx_quadra_mensalistas_ativo ON public.quadra_mensalistas (ativo, dia_semana, horario_inicio);

-- -----------------------------------------------------------------------------
-- 2. Reservas (aluguel avulso de horário)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quadra_reservas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data              date NOT NULL,
  horario_inicio    time NOT NULL,
  horario_fim       time NOT NULL,
  cliente_nome      text NOT NULL CHECK (char_length(cliente_nome) BETWEEN 2 AND 120),
  cliente_telefone  text,
  mensalista_id     uuid REFERENCES public.quadra_mensalistas(id) ON DELETE SET NULL,
  valor             numeric(12,2) NOT NULL CHECK (valor >= 0),
  status            text NOT NULL DEFAULT 'confirmada'
                    CHECK (status IN ('confirmada','realizada','cancelada')),
  status_pagamento  text NOT NULL DEFAULT 'pendente'
                    CHECK (status_pagamento IN ('pendente','pago')),
  forma_pagamento   text CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('pix','dinheiro','cartao_credito','cartao_debito','transferencia','boleto','outro')),
  observacoes       text,
  created_by        uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quadra_reservas_horario_ck CHECK (horario_fim > horario_inicio)
);

CREATE INDEX IF NOT EXISTS idx_quadra_reservas_data ON public.quadra_reservas (data, horario_inicio);
CREATE INDEX IF NOT EXISTS idx_quadra_reservas_status ON public.quadra_reservas (status, status_pagamento);

-- -----------------------------------------------------------------------------
-- 3. Lançamentos (livro-caixa)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quadra_lancamentos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                    text NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria               text NOT NULL CHECK (char_length(categoria) BETWEEN 2 AND 60),
  descricao               text NOT NULL CHECK (char_length(descricao) BETWEEN 2 AND 200),
  valor                   numeric(12,2) NOT NULL CHECK (valor > 0),
  data_competencia        date NOT NULL,
  data_vencimento         date NOT NULL,
  data_pagamento          date,
  status                  text NOT NULL DEFAULT 'pendente'
                          CHECK (status IN ('pendente','pago','cancelado')),
  forma_pagamento         text CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('pix','dinheiro','cartao_credito','cartao_debito','transferencia','boleto','outro')),
  reserva_id              uuid UNIQUE REFERENCES public.quadra_reservas(id) ON DELETE CASCADE,
  mensalista_id           uuid REFERENCES public.quadra_mensalistas(id) ON DELETE SET NULL,
  competencia_mensalidade date,
  observacoes             text,
  created_by              uuid DEFAULT auth.uid(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quadra_lancamentos_pago_ck CHECK (status <> 'pago' OR data_pagamento IS NOT NULL)
);

-- Uma mensalidade por mensalista por competência (idempotência da geração)
CREATE UNIQUE INDEX IF NOT EXISTS uq_quadra_lanc_mensalidade
  ON public.quadra_lancamentos (mensalista_id, competencia_mensalidade)
  WHERE competencia_mensalidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quadra_lanc_competencia ON public.quadra_lancamentos (data_competencia, tipo);
CREATE INDEX IF NOT EXISTS idx_quadra_lanc_vencimento ON public.quadra_lancamentos (status, data_vencimento);

-- -----------------------------------------------------------------------------
-- 4. updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_quadra_mensalistas_updated_at ON public.quadra_mensalistas;
CREATE TRIGGER trg_quadra_mensalistas_updated_at
  BEFORE UPDATE ON public.quadra_mensalistas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_quadra_reservas_updated_at ON public.quadra_reservas;
CREATE TRIGGER trg_quadra_reservas_updated_at
  BEFORE UPDATE ON public.quadra_reservas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_quadra_lancamentos_updated_at ON public.quadra_lancamentos;
CREATE TRIGGER trg_quadra_lancamentos_updated_at
  BEFORE UPDATE ON public.quadra_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 5. Reserva → lançamento de receita (fonte única de verdade no livro-caixa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quadra_sync_lancamento_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_descricao text;
  v_status    text;
BEGIN
  v_descricao := 'Reserva ' || NEW.cliente_nome || ' - '
    || to_char(NEW.horario_inicio, 'HH24:MI') || ' às ' || to_char(NEW.horario_fim, 'HH24:MI');

  v_status := CASE
    WHEN NEW.status = 'cancelada' THEN 'cancelado'
    WHEN NEW.status_pagamento = 'pago' THEN 'pago'
    ELSE 'pendente'
  END;

  INSERT INTO public.quadra_lancamentos AS l (
    tipo, categoria, descricao, valor, data_competencia, data_vencimento,
    data_pagamento, status, forma_pagamento, reserva_id, mensalista_id, created_by
  ) VALUES (
    'receita', 'aluguel_horario', v_descricao, GREATEST(NEW.valor, 0.01), NEW.data, NEW.data,
    CASE WHEN v_status = 'pago' THEN NEW.data ELSE NULL END,
    v_status, NEW.forma_pagamento, NEW.id, NEW.mensalista_id, NEW.created_by
  )
  ON CONFLICT (reserva_id) DO UPDATE SET
    descricao        = EXCLUDED.descricao,
    valor            = EXCLUDED.valor,
    data_competencia = EXCLUDED.data_competencia,
    data_vencimento  = EXCLUDED.data_vencimento,
    status           = EXCLUDED.status,
    forma_pagamento  = EXCLUDED.forma_pagamento,
    mensalista_id    = EXCLUDED.mensalista_id,
    data_pagamento   = CASE
                         WHEN EXCLUDED.status = 'pago' THEN COALESCE(l.data_pagamento, EXCLUDED.data_competencia)
                         ELSE NULL
                       END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.quadra_sync_lancamento_reserva() FROM authenticated, anon, public;

DROP TRIGGER IF EXISTS trg_quadra_reservas_sync_lancamento ON public.quadra_reservas;
CREATE TRIGGER trg_quadra_reservas_sync_lancamento
  AFTER INSERT OR UPDATE OF valor, data, horario_inicio, horario_fim, cliente_nome,
                            status, status_pagamento, forma_pagamento, mensalista_id
  ON public.quadra_reservas
  FOR EACH ROW EXECUTE FUNCTION public.quadra_sync_lancamento_reserva();

-- -----------------------------------------------------------------------------
-- 6. Geração de mensalidades do mês (idempotente)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quadra_gerar_mensalidades(p_competencia date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_competencia date := date_trunc('month', p_competencia)::date;
  v_inseridos   integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_user_access(auth.uid(), 'quadra') THEN
    RAISE EXCEPTION 'Acesso negado ao módulo quadra' USING ERRCODE = '42501';
  END IF;

  WITH ins AS (
    INSERT INTO public.quadra_lancamentos (
      tipo, categoria, descricao, valor, data_competencia, data_vencimento,
      status, mensalista_id, competencia_mensalidade, created_by
    )
    SELECT
      'receita',
      'mensalidade',
      'Mensalidade ' || m.nome || ' - ' || to_char(v_competencia, 'MM/YYYY'),
      m.valor_mensal,
      v_competencia,
      make_date(EXTRACT(YEAR FROM v_competencia)::int, EXTRACT(MONTH FROM v_competencia)::int, m.dia_vencimento),
      'pendente',
      m.id,
      v_competencia,
      auth.uid()
    FROM public.quadra_mensalistas m
    WHERE m.ativo = true AND m.valor_mensal > 0
    ON CONFLICT (mensalista_id, competencia_mensalidade) WHERE competencia_mensalidade IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridos FROM ins;

  RETURN v_inseridos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.quadra_gerar_mensalidades(date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.quadra_gerar_mensalidades(date) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 7. RLS — acesso restrito a quem tem o módulo `quadra`
-- -----------------------------------------------------------------------------
ALTER TABLE public.quadra_mensalistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadra_reservas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadra_lancamentos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quadra_mensalistas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quadra_reservas    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quadra_lancamentos TO authenticated;
GRANT ALL ON public.quadra_mensalistas, public.quadra_reservas, public.quadra_lancamentos TO service_role;

DROP POLICY IF EXISTS quadra_mensalistas_all ON public.quadra_mensalistas;
CREATE POLICY quadra_mensalistas_all ON public.quadra_mensalistas
  FOR ALL TO authenticated
  USING (public.check_user_access(auth.uid(), 'quadra'))
  WITH CHECK (public.check_user_access(auth.uid(), 'quadra'));

DROP POLICY IF EXISTS quadra_reservas_all ON public.quadra_reservas;
CREATE POLICY quadra_reservas_all ON public.quadra_reservas
  FOR ALL TO authenticated
  USING (public.check_user_access(auth.uid(), 'quadra'))
  WITH CHECK (public.check_user_access(auth.uid(), 'quadra'));

DROP POLICY IF EXISTS quadra_lancamentos_all ON public.quadra_lancamentos;
CREATE POLICY quadra_lancamentos_all ON public.quadra_lancamentos
  FOR ALL TO authenticated
  USING (public.check_user_access(auth.uid(), 'quadra'))
  WITH CHECK (public.check_user_access(auth.uid(), 'quadra'));

-- -----------------------------------------------------------------------------
-- 8. Módulo, tela, permissões padrão e menu lateral
-- -----------------------------------------------------------------------------
INSERT INTO public.modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('quadra', 'Quadra de Futebol', 'Controle financeiro da quadra: reservas, mensalistas, receitas e despesas', 'Trophy', 60, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.telas_sistema (codigo, nome, descricao, rota, modulo_codigo, icone, ativo, ordem, acesso_padrao)
VALUES ('quadra_financeiro',
        'Quadra — Financeiro',
        'Painel, lançamentos, reservas e mensalistas da quadra de futebol',
        '/dashboard/quadra',
        'quadra', 'Trophy', true, 1, false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.role_permissoes_modulos (role, modulo_id)
SELECT r::app_role, m.id
FROM public.modulos_sistema m
CROSS JOIN (VALUES ('admin'), ('supervisor'), ('gerente')) AS roles(r)
WHERE m.codigo = 'quadra'
ON CONFLICT (role, modulo_id) DO NOTHING;

INSERT INTO public.role_permissoes_telas (role, tela_id)
SELECT r::app_role, t.id
FROM public.telas_sistema t
CROSS JOIN (VALUES ('admin'), ('supervisor'), ('gerente')) AS roles(r)
WHERE t.codigo = 'quadra_financeiro'
ON CONFLICT (role, tela_id) DO NOTHING;

INSERT INTO public.sidebar_categories (key, label, icon, ordem, ativo)
VALUES ('quadra', 'Quadra de Futebol', 'Trophy', 9, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.sidebar_category_modules (category_id, module_code, icon_override, ordem, ativo)
SELECT c.id, 'quadra', 'Trophy', 1, true
FROM public.sidebar_categories c
WHERE c.key = 'quadra'
ON CONFLICT (category_id, module_code) DO NOTHING;

INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
VALUES
  ('quadra', 'quadra_dashboard',   'Painel',       'LayoutDashboard', '/dashboard/quadra',             1, true, 'quadra_financeiro'),
  ('quadra', 'quadra_lancamentos', 'Lançamentos',  'Receipt',         '/dashboard/quadra/lancamentos', 2, true, 'quadra_financeiro'),
  ('quadra', 'quadra_reservas',    'Reservas',     'CalendarDays',    '/dashboard/quadra/reservas',    3, true, 'quadra_financeiro'),
  ('quadra', 'quadra_mensalistas', 'Mensalistas',  'Users',           '/dashboard/quadra/mensalistas', 4, true, 'quadra_financeiro')
ON CONFLICT (module_code, item_code) DO NOTHING;
