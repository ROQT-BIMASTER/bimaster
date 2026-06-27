
ALTER TABLE public.erp_vendas ADD COLUMN IF NOT EXISTS tabela_preco_id integer;
ALTER TABLE public.erp_vendas ADD COLUMN IF NOT EXISTS tabela_preco_nome text;

DROP VIEW IF EXISTS public.v_vendas;
CREATE VIEW public.v_vendas AS
SELECT v.futura_nota_id,
    v.empresa_id,
    v.nro_nota,
    v.serie,
    v.data_emissao,
    v.cliente_futura_id,
    v.cliente_nome,
    v.cliente_cnpj_cpf,
    v.vendedor_futura_id,
    vd.id AS vendedor_id,
    vd.nome AS vendedor_nome,
    vd.coordenador_id,
    c.nome AS coordenador_nome,
    v.tabela_preco_id,
    v.tabela_preco_nome,
    v.quantidade,
    v.total_produto,
    v.total_desconto,
    v.total_nota,
    v.status,
    v.sincronizado_em
FROM public.erp_vendas v
LEFT JOIN public.vendedores vd ON vd.futura_id = v.vendedor_futura_id
LEFT JOIN public.coordenadores c ON c.id = vd.coordenador_id
WHERE v.entrada_saida = 'S'::bpchar AND v.status = 1;

CREATE OR REPLACE FUNCTION public.vendas_por_tabela(
  p_de date,
  p_ate date,
  p_empresa_id smallint DEFAULT NULL,
  p_vendedor_futura_id integer DEFAULT NULL
)
RETURNS TABLE (
  tabela_preco_id integer,
  tabela_preco_nome text,
  faturamento numeric,
  notas bigint,
  qtd_un numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT v.futura_nota_id, v.tabela_preco_id, v.tabela_preco_nome, v.total_produto
    FROM public.erp_vendas v
    WHERE v.entrada_saida = 'S' AND v.status = 1
      AND v.data_emissao BETWEEN p_de AND p_ate
      AND (p_empresa_id IS NULL OR v.empresa_id = p_empresa_id)
      AND (p_vendedor_futura_id IS NULL OR v.vendedor_futura_id = p_vendedor_futura_id)
  ),
  itens AS (
    SELECT vi.futura_nota_id, SUM(COALESCE(vi.quantidade_un, 0)) AS qtd_un
    FROM public.erp_vendas_item vi
    WHERE vi.futura_nota_id IN (SELECT futura_nota_id FROM base)
    GROUP BY vi.futura_nota_id
  )
  SELECT b.tabela_preco_id,
         COALESCE(b.tabela_preco_nome, '(sem tabela)') AS tabela_preco_nome,
         SUM(b.total_produto) AS faturamento,
         COUNT(*)::bigint AS notas,
         COALESCE(SUM(i.qtd_un), 0) AS qtd_un
  FROM base b
  LEFT JOIN itens i ON i.futura_nota_id = b.futura_nota_id
  GROUP BY b.tabela_preco_id, b.tabela_preco_nome
  ORDER BY faturamento DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_por_tabela(date, date, smallint, integer) TO authenticated;
