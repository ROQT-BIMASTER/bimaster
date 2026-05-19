
-- ============================================================
-- v10 Planilha Import: alinhar schema ao spec Crystal Company
-- ============================================================

-- 1) Ampliar regras de markup das tabelas de preço
ALTER TABLE public.fabrica_tabelas_preco
  DROP CONSTRAINT IF EXISTS tipo_markup_valido;

ALTER TABLE public.fabrica_tabelas_preco
  ADD CONSTRAINT tipo_markup_valido CHECK (
    (tipo_markup)::text = ANY (ARRAY[
      'percentual'::text,        -- MARKUP_PCT
      'multiplicador'::text,
      'valor_fixo'::text,        -- ACRESCIMO_FIXO
      'margem_pct'::text,        -- preço = base / (1 - valor)
      'desconto_pct'::text       -- preço = base * (1 - valor)
    ])
  );

-- 2) Marcar tabelas que aceitam preço final manual (E-commerce)
ALTER TABLE public.fabrica_tabelas_preco
  ADD COLUMN IF NOT EXISTS permite_preco_manual BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fabrica_tabelas_preco.permite_preco_manual IS
  'Quando true, o comercial pode digitar preco_manual em fabrica_precos_produtos; status_preco compara com preco_calculado (Sug. Mín).';

-- 3) Status derivado do preço (Pendente / OK / Igual / ABAIXO DA SUG)
ALTER TABLE public.fabrica_precos_produtos
  ADD COLUMN IF NOT EXISTS status_preco TEXT
  GENERATED ALWAYS AS (
    CASE
      WHEN preco_manual IS NULL THEN 'pendente'
      WHEN preco_calculado IS NULL THEN 'sem_sugestao'
      WHEN preco_manual < preco_calculado THEN 'abaixo_da_sug'
      WHEN preco_manual = preco_calculado THEN 'igual'
      ELSE 'ok'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_fabrica_precos_status
  ON public.fabrica_precos_produtos(status_preco)
  WHERE status_preco IN ('pendente','abaixo_da_sug');

-- 4) fabrica_produtos: tipo_sku + sku_pai + parametros_fiscais
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fabrica_tipo_sku') THEN
    CREATE TYPE public.fabrica_tipo_sku AS ENUM (
      'produto',
      'provador',
      'produto_sugestao',
      'provador_sugestao'
    );
  END IF;
END$$;

ALTER TABLE public.fabrica_produtos
  ADD COLUMN IF NOT EXISTS tipo_sku public.fabrica_tipo_sku
    NOT NULL DEFAULT 'produto',
  ADD COLUMN IF NOT EXISTS sku_pai_id UUID
    REFERENCES public.fabrica_produtos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS oficial BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS versao TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS parametros_fiscais JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS codigo_erp TEXT,
  ADD COLUMN IF NOT EXISTS ficha_id TEXT;

CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_tipo_sku
  ON public.fabrica_produtos(tipo_sku) WHERE oficial = true;
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_sku_pai
  ON public.fabrica_produtos(sku_pai_id) WHERE sku_pai_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fabrica_produtos_codigo_erp
  ON public.fabrica_produtos(codigo_erp) WHERE codigo_erp IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_fabrica_produtos_ficha_id
  ON public.fabrica_produtos(ficha_id) WHERE ficha_id IS NOT NULL;

-- Migrar flag legado is_provador → tipo_sku
UPDATE public.fabrica_produtos
   SET tipo_sku = 'provador'
 WHERE is_provador = true
   AND tipo_sku = 'produto';

COMMENT ON COLUMN public.fabrica_produtos.parametros_fiscais IS
  'JSONB: { reducao_bc: 0.52, icms: 0.25, ipi: 0.143 }. ICMS e Reducao sao apenas informativos; apenas IPI entra no Custo Final.';

-- 5) fabrica_produto_custos: origem do preço + NF
ALTER TABLE public.fabrica_produto_custos
  ADD COLUMN IF NOT EXISTS origem_preco TEXT
    CHECK (origem_preco IS NULL OR origem_preco IN ('nota_fiscal','orcamento','tabela')),
  ADD COLUMN IF NOT EXISTS codigo_insumo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS custo_nf_made_in NUMERIC(15,6) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fabrica_produto_custos_codigo_insumo
  ON public.fabrica_produto_custos(codigo_insumo) WHERE codigo_insumo IS NOT NULL;

-- 6) View de provadores com % do pai
CREATE OR REPLACE VIEW public.vw_fabrica_provadores_custo AS
SELECT
  p.id                          AS provador_id,
  p.codigo_erp                  AS provador_codigo,
  p.nome                        AS provador_nome,
  p.tipo_sku,
  p.oficial,
  p.custo_unitario              AS custo_fabrica,
  pai.id                        AS pai_id,
  pai.codigo_erp                AS pai_codigo,
  pai.nome                      AS pai_nome,
  pai.custo_unitario            AS custo_pai,
  CASE
    WHEN pai.custo_unitario IS NULL OR pai.custo_unitario = 0 THEN NULL
    ELSE ROUND( (p.custo_unitario / pai.custo_unitario)::numeric, 4 )
  END                           AS pct_do_pai
FROM public.fabrica_produtos p
LEFT JOIN public.fabrica_produtos pai ON pai.id = p.sku_pai_id
WHERE p.tipo_sku IN ('provador','provador_sugestao');

COMMENT ON VIEW public.vw_fabrica_provadores_custo IS
  'Lista de provadores (oficiais + sugestoes) com custo de fabrica e percentual do pai. Provadores NAO entram na cascata comercial.';

-- 7) Função de recálculo de Custo Final (IPI entra, ICMS/Reducao nao)
CREATE OR REPLACE FUNCTION public.fn_fabrica_recalc_custo_final(p_produto_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_nf NUMERIC := 0;
  v_servico NUMERIC := 0;
  v_condicao NUMERIC := 0;
  v_made_in NUMERIC := 0;
  v_ipi_pct NUMERIC := 0;
  v_custo_final NUMERIC := 0;
BEGIN
  SELECT
    COALESCE(SUM(custo_nf), 0),
    COALESCE(SUM(custo_servico), 0),
    COALESCE(SUM(custo_condicao), 0),
    COALESCE(SUM(custo_nf_made_in), 0)
  INTO v_total_nf, v_servico, v_condicao, v_made_in
  FROM public.fabrica_produto_custos
  WHERE produto_id = p_produto_id;

  SELECT COALESCE((parametros_fiscais->>'ipi')::numeric, 0)
    INTO v_ipi_pct
    FROM public.fabrica_produtos
   WHERE id = p_produto_id;

  v_custo_final := v_total_nf * (1 + v_ipi_pct) + v_servico + v_condicao + v_made_in;

  UPDATE public.fabrica_produtos
     SET custo_unitario = v_custo_final,
         updated_at = now()
   WHERE id = p_produto_id;

  RETURN v_custo_final;
END;
$$;

-- 8) Trigger: recalcula ao mexer nos custos
CREATE OR REPLACE FUNCTION public.tg_fabrica_recalc_custo_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fn_fabrica_recalc_custo_final(OLD.produto_id);
    RETURN OLD;
  ELSE
    PERFORM public.fn_fabrica_recalc_custo_final(NEW.produto_id);
    IF TG_OP = 'UPDATE' AND OLD.produto_id <> NEW.produto_id THEN
      PERFORM public.fn_fabrica_recalc_custo_final(OLD.produto_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS tr_fabrica_produto_custos_recalc ON public.fabrica_produto_custos;
CREATE TRIGGER tr_fabrica_produto_custos_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.fabrica_produto_custos
FOR EACH ROW EXECUTE FUNCTION public.tg_fabrica_recalc_custo_after_change();
