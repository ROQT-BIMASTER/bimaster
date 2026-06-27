CREATE OR REPLACE FUNCTION public.vendas_analise(
  p_metrica   text,
  p_dimensao  text,
  p_de        date,
  p_ate       date,
  p_empresa_id          smallint DEFAULT NULL,
  p_vendedor_futura_id  integer  DEFAULT NULL,
  p_tabela_id           integer  DEFAULT NULL,
  p_limit               int      DEFAULT 50
)
RETURNS TABLE (label text, valor numeric)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_grain  text;
  v_dim    text;
  v_metric text;
  v_from   text;
  v_sql    text;
BEGIN
  v_grain := CASE WHEN p_metrica = 'quantidade' OR p_dimensao = 'produto' THEN 'item' ELSE 'header' END;

  v_dim := CASE p_dimensao
    WHEN 'mes'         THEN $q$to_char(date_trunc('month',   v.data_emissao),'YYYY-MM')$q$
    WHEN 'trimestre'   THEN $q$to_char(date_trunc('quarter', v.data_emissao),'YYYY-"T"Q')$q$
    WHEN 'ano'         THEN $q$to_char(date_trunc('year',    v.data_emissao),'YYYY')$q$
    WHEN 'vendedor'    THEN $q$COALESCE(vd.nome, 'Vendedor '||v.vendedor_futura_id)$q$
    WHEN 'coordenador' THEN $q$COALESCE(co.nome, '(sem coordenador)')$q$
    WHEN 'cliente'     THEN $q$COALESCE(v.cliente_nome, 'Cliente '||v.cliente_futura_id)$q$
    WHEN 'empresa'     THEN $q$CASE v.empresa_id WHEN 1 THEN 'NELIDA' WHEN 3 THEN 'FABULOUS' ELSE 'Empresa '||v.empresa_id END$q$
    WHEN 'tabela'      THEN $q$COALESCE(v.tabela_preco_nome,'(sem tabela)')$q$
    WHEN 'tipo_pedido' THEN $q$'Tipo '||v.tipo_pedido_id$q$
    WHEN 'produto'     THEN $q$COALESCE(vi.descricao, 'Cód '||vi.cod_produto)$q$
    ELSE NULL
  END;
  IF v_dim IS NULL THEN
    RAISE EXCEPTION 'dimensao invalida: %', p_dimensao;
  END IF;

  IF v_grain = 'item' THEN
    v_metric := CASE p_metrica
      WHEN 'quantidade'  THEN 'SUM(COALESCE(vi.quantidade_un,0))'
      WHEN 'faturamento' THEN 'SUM(vi.total_item)'
      WHEN 'notas'       THEN 'COUNT(DISTINCT v.futura_nota_id)'
      WHEN 'clientes'    THEN 'COUNT(DISTINCT v.cliente_futura_id)'
      WHEN 'desconto'    THEN 'SUM(vi.desconto_valor)'
      WHEN 'ticket'      THEN 'SUM(vi.total_item)/NULLIF(COUNT(DISTINCT v.futura_nota_id),0)'
      ELSE NULL
    END;
    v_from := 'erp_vendas_item vi JOIN erp_vendas v ON v.futura_nota_id = vi.futura_nota_id';
  ELSE
    v_metric := CASE p_metrica
      WHEN 'faturamento'          THEN 'SUM(v.total_produto)'
      WHEN 'faturamento_impostos' THEN 'SUM(v.total_nota)'
      WHEN 'notas'                THEN 'COUNT(*)'
      WHEN 'clientes'             THEN 'COUNT(DISTINCT v.cliente_futura_id)'
      WHEN 'desconto'             THEN 'SUM(v.total_desconto)'
      WHEN 'ticket'               THEN 'SUM(v.total_produto)/NULLIF(COUNT(*),0)'
      ELSE NULL
    END;
    v_from := 'erp_vendas v';
  END IF;
  IF v_metric IS NULL THEN
    RAISE EXCEPTION 'metrica invalida p/ grain %: %', v_grain, p_metrica;
  END IF;

  v_sql := format($f$
    SELECT %s AS label, %s AS valor
    FROM %s
    LEFT JOIN vendedores    vd ON vd.futura_id = v.vendedor_futura_id
    LEFT JOIN coordenadores co ON co.id       = vd.coordenador_id
    WHERE v.entrada_saida = 'S'
      AND v.status = 1
      AND v.data_emissao BETWEEN $1 AND $2
      AND ($3::smallint IS NULL OR v.empresa_id          = $3)
      AND ($4::integer  IS NULL OR v.vendedor_futura_id  = $4)
      AND ($5::integer  IS NULL OR v.tabela_preco_id     = $5)
    GROUP BY 1
    ORDER BY valor DESC NULLS LAST
    LIMIT $6
  $f$, v_dim, v_metric, v_from);

  RETURN QUERY EXECUTE v_sql
    USING p_de, p_ate, p_empresa_id, p_vendedor_futura_id, p_tabela_id, p_limit;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.vendas_analise(text,text,date,date,smallint,integer,integer,int) TO authenticated;