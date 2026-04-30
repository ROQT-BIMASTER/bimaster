
-- 1) Saldo lógico interno por lote de origem
CREATE TABLE IF NOT EXISTS public.estoque_lote_interno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa INTEGER NOT NULL,
  cod_produto INTEGER NOT NULL,
  nivel SMALLINT,
  lote_origem TEXT,
  raiz_cod INTEGER,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  custo_unitario NUMERIC,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_eli_empresa_produto_lote
  ON public.estoque_lote_interno (empresa, cod_produto, COALESCE(lote_origem, ''));

CREATE INDEX IF NOT EXISTS idx_eli_empresa_produto ON public.estoque_lote_interno(empresa, cod_produto);
CREATE INDEX IF NOT EXISTS idx_eli_raiz ON public.estoque_lote_interno(empresa, raiz_cod);

ALTER TABLE public.estoque_lote_interno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read lote interno" ON public.estoque_lote_interno
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin manage lote interno" ON public.estoque_lote_interno
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_eli_updated_at
  BEFORE UPDATE ON public.estoque_lote_interno
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Histórico de movimentações
CREATE TABLE IF NOT EXISTS public.estoque_movimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('desmontagem','remontagem','ajuste','sync_erp')),
  pai_cod INTEGER,
  filho_cod INTEGER,
  quantidade_pai NUMERIC,
  quantidade_filho NUMERIC,
  fator_bom NUMERIC,
  lote_origem TEXT,
  raiz_cod INTEGER,
  motivo TEXT,
  unidades_equivalentes NUMERIC,
  executado_por UUID REFERENCES auth.users(id),
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emov_empresa_data ON public.estoque_movimento(empresa, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_emov_pai ON public.estoque_movimento(empresa, pai_cod);
CREATE INDEX IF NOT EXISTS idx_emov_tipo ON public.estoque_movimento(tipo);

ALTER TABLE public.estoque_movimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read movimentos" ON public.estoque_movimento
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert movimentos" ON public.estoque_movimento
  FOR INSERT TO authenticated
  WITH CHECK (executado_por = auth.uid());

CREATE POLICY "admin manage movimentos" ON public.estoque_movimento
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) RPC executar_desmontagem
CREATE OR REPLACE FUNCTION public.executar_desmontagem(
  p_empresa INTEGER,
  p_pai_cod INTEGER,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL,
  p_lote_origem TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_saldo_atual NUMERIC;
  v_saldo_erp NUMERIC;
  v_filho RECORD;
  v_qtd_filho NUMERIC;
  v_total_eq NUMERIC := 0;
  v_movs JSONB := '[]'::jsonb;
  v_nivel_pai SMALLINT;
  v_raiz INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bom_edges
    WHERE empresa = p_empresa AND pai_cod = p_pai_cod AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Produto % não possui composição (BOM) ativa para empresa %', p_pai_cod, p_empresa;
  END IF;

  SELECT nivel, raiz_cod INTO v_nivel_pai, v_raiz
    FROM public.estoque_produto_nivel
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod LIMIT 1;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_saldo_atual
    FROM public.estoque_lote_interno
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod
     AND (p_lote_origem IS NULL OR lote_origem IS NOT DISTINCT FROM p_lote_origem);

  IF v_saldo_atual = 0 THEN
    SELECT COALESCE(SUM(saldo), 0) INTO v_saldo_erp
      FROM public.erp_estoque_distribuidora
     WHERE empresa_par = p_empresa AND cod_produto = p_pai_cod;

    IF v_saldo_erp < p_quantidade THEN
      RAISE EXCEPTION 'Saldo insuficiente: disponível % (ERP), solicitado %', v_saldo_erp, p_quantidade;
    END IF;

    INSERT INTO public.estoque_lote_interno(empresa, cod_produto, nivel, lote_origem, raiz_cod, quantidade)
    VALUES (p_empresa, p_pai_cod, v_nivel_pai, p_lote_origem, v_raiz, v_saldo_erp)
    ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
      SET quantidade = EXCLUDED.quantidade;
    v_saldo_atual := v_saldo_erp;
  END IF;

  IF v_saldo_atual < p_quantidade THEN
    RAISE EXCEPTION 'Saldo lógico insuficiente: disponível %, solicitado %', v_saldo_atual, p_quantidade;
  END IF;

  UPDATE public.estoque_lote_interno
     SET quantidade = quantidade - p_quantidade, updated_at = now()
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod
     AND (p_lote_origem IS NULL OR lote_origem IS NOT DISTINCT FROM p_lote_origem);

  FOR v_filho IN
    SELECT filho_cod, quantidade AS fator
      FROM public.bom_edges
     WHERE empresa = p_empresa AND pai_cod = p_pai_cod AND ativo = true
  LOOP
    v_qtd_filho := p_quantidade * v_filho.fator;
    v_total_eq := v_total_eq + v_qtd_filho;

    INSERT INTO public.estoque_lote_interno(empresa, cod_produto, lote_origem, raiz_cod, quantidade)
    VALUES (p_empresa, v_filho.filho_cod, COALESCE(p_lote_origem, p_pai_cod::text), COALESCE(v_raiz, p_pai_cod), v_qtd_filho)
    ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
      SET quantidade = estoque_lote_interno.quantidade + EXCLUDED.quantidade,
          updated_at = now();

    INSERT INTO public.estoque_movimento(
      empresa, tipo, pai_cod, filho_cod, quantidade_pai, quantidade_filho,
      fator_bom, lote_origem, raiz_cod, motivo, unidades_equivalentes, executado_por
    ) VALUES (
      p_empresa, 'desmontagem', p_pai_cod, v_filho.filho_cod, p_quantidade, v_qtd_filho,
      v_filho.fator, p_lote_origem, v_raiz, p_motivo, v_qtd_filho, v_uid
    );

    v_movs := v_movs || jsonb_build_object(
      'filho_cod', v_filho.filho_cod, 'quantidade', v_qtd_filho, 'fator', v_filho.fator
    );
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true, 'pai_cod', p_pai_cod,
    'quantidade_desmontada', p_quantidade,
    'filhos_gerados', v_movs,
    'unidades_equivalentes_total', v_total_eq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.executar_desmontagem(INTEGER, INTEGER, NUMERIC, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.executar_desmontagem(INTEGER, INTEGER, NUMERIC, TEXT, TEXT) TO authenticated;

-- 4) RPC executar_remontagem
CREATE OR REPLACE FUNCTION public.executar_remontagem(
  p_empresa INTEGER,
  p_pai_cod INTEGER,
  p_quantidade NUMERIC,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_filho RECORD;
  v_necessario NUMERIC;
  v_disponivel NUMERIC;
  v_total_eq NUMERIC := 0;
  v_movs JSONB := '[]'::jsonb;
  v_raiz INTEGER;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'Quantidade deve ser maior que zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bom_edges
    WHERE empresa = p_empresa AND pai_cod = p_pai_cod AND ativo = true
  ) THEN
    RAISE EXCEPTION 'Produto % não possui BOM para remontagem', p_pai_cod;
  END IF;

  SELECT raiz_cod INTO v_raiz FROM public.estoque_produto_nivel
   WHERE empresa = p_empresa AND cod_produto = p_pai_cod LIMIT 1;

  FOR v_filho IN
    SELECT filho_cod, quantidade AS fator
      FROM public.bom_edges
     WHERE empresa = p_empresa AND pai_cod = p_pai_cod AND ativo = true
  LOOP
    v_necessario := p_quantidade * v_filho.fator;
    SELECT COALESCE(SUM(quantidade), 0) INTO v_disponivel
      FROM public.estoque_lote_interno
     WHERE empresa = p_empresa AND cod_produto = v_filho.filho_cod;
    IF v_disponivel < v_necessario THEN
      RAISE EXCEPTION 'Componente % insuficiente: precisa %, disponível %',
        v_filho.filho_cod, v_necessario, v_disponivel;
    END IF;
  END LOOP;

  FOR v_filho IN
    SELECT filho_cod, quantidade AS fator
      FROM public.bom_edges
     WHERE empresa = p_empresa AND pai_cod = p_pai_cod AND ativo = true
  LOOP
    v_necessario := p_quantidade * v_filho.fator;
    v_total_eq := v_total_eq + v_necessario;

    UPDATE public.estoque_lote_interno
       SET quantidade = GREATEST(0, quantidade - v_necessario), updated_at = now()
     WHERE id = (
       SELECT id FROM public.estoque_lote_interno
        WHERE empresa = p_empresa AND cod_produto = v_filho.filho_cod
          AND quantidade > 0
        ORDER BY updated_at ASC LIMIT 1
     );

    INSERT INTO public.estoque_movimento(
      empresa, tipo, pai_cod, filho_cod, quantidade_pai, quantidade_filho,
      fator_bom, raiz_cod, motivo, unidades_equivalentes, executado_por
    ) VALUES (
      p_empresa, 'remontagem', p_pai_cod, v_filho.filho_cod, p_quantidade, v_necessario,
      v_filho.fator, v_raiz, p_motivo, v_necessario, v_uid
    );

    v_movs := v_movs || jsonb_build_object(
      'filho_cod', v_filho.filho_cod, 'consumido', v_necessario, 'fator', v_filho.fator
    );
  END LOOP;

  INSERT INTO public.estoque_lote_interno(empresa, cod_produto, lote_origem, raiz_cod, quantidade)
  VALUES (p_empresa, p_pai_cod, NULL, COALESCE(v_raiz, p_pai_cod), p_quantidade)
  ON CONFLICT (empresa, cod_produto, COALESCE(lote_origem, '')) DO UPDATE
    SET quantidade = estoque_lote_interno.quantidade + EXCLUDED.quantidade,
        updated_at = now();

  RETURN jsonb_build_object(
    'ok', true, 'pai_cod', p_pai_cod,
    'quantidade_remontada', p_quantidade,
    'componentes_consumidos', v_movs,
    'unidades_equivalentes_total', v_total_eq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.executar_remontagem(INTEGER, INTEGER, NUMERIC, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.executar_remontagem(INTEGER, INTEGER, NUMERIC, TEXT) TO authenticated;

-- 5) View de drift interno vs ERP
CREATE OR REPLACE VIEW public.vw_drift_erp_unificado
WITH (security_invoker = true) AS
SELECT
  COALESCE(eli.empresa, erp.empresa_par)            AS empresa,
  COALESCE(eli.cod_produto, erp.cod_produto)        AS cod_produto,
  MAX(erp.nome_prod)                                AS nome_prod,
  COALESCE(SUM(eli.quantidade), 0)                  AS saldo_interno,
  COALESCE(SUM(erp.saldo), 0)                       AS saldo_erp,
  COALESCE(SUM(eli.quantidade), 0) - COALESCE(SUM(erp.saldo), 0) AS drift,
  CASE
    WHEN COALESCE(SUM(erp.saldo),0) = 0 AND COALESCE(SUM(eli.quantidade),0) = 0 THEN 0
    WHEN COALESCE(SUM(erp.saldo),0) = 0 THEN 100
    ELSE ROUND(
      ABS(COALESCE(SUM(eli.quantidade),0) - COALESCE(SUM(erp.saldo),0))
      / NULLIF(COALESCE(SUM(erp.saldo),0),0) * 100, 2)
  END AS drift_pct
FROM public.estoque_lote_interno eli
FULL OUTER JOIN public.erp_estoque_distribuidora erp
  ON erp.empresa_par = eli.empresa AND erp.cod_produto = eli.cod_produto
GROUP BY 1,2;

GRANT SELECT ON public.vw_drift_erp_unificado TO authenticated;
