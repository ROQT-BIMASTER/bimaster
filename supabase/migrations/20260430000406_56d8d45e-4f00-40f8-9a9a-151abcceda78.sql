-- Índices para acelerar joins entre composição e estoque
CREATE INDEX IF NOT EXISTS idx_erp_composicao_produto_compo ON public.erp_composicao_produto(produto_compo);
CREATE INDEX IF NOT EXISTS idx_erp_composicao_materia_compo ON public.erp_composicao_produto(materia_compo);
CREATE INDEX IF NOT EXISTS idx_erp_composicao_empresa_compo ON public.erp_composicao_produto(empresa_compo);
CREATE INDEX IF NOT EXISTS idx_erp_estoque_distribuidora_cod_produto ON public.erp_estoque_distribuidora(cod_produto);
CREATE INDEX IF NOT EXISTS idx_erp_estoque_distribuidora_empresa_par ON public.erp_estoque_distribuidora(empresa_par);

-- View que relaciona composição (matéria-prima) com saldo de estoque das matérias
-- Permite calcular: para um produto acabado X, qual a disponibilidade real de cada matéria-prima
CREATE OR REPLACE VIEW public.vw_composicao_estoque AS
SELECT
  c.empresa_compo,
  c.produto_compo,
  pp.nome_prod AS nome_produto_acabado,
  pp.curva_fisica AS curva_produto_acabado,
  c.materia_compo,
  em.nome_prod AS nome_materia_prima,
  em.unidade_medida AS unidade_materia,
  c.quantidade_compo,
  COALESCE(em.saldo, 0) AS saldo_materia,
  COALESCE(em.estoque_bloqueado_produto, 0) AS bloqueado_materia,
  COALESCE(em.custo_unitario, 0) AS custo_unitario_materia,
  (c.quantidade_compo * COALESCE(em.custo_unitario, 0))::numeric(18,6) AS custo_unitario_composicao,
  CASE
    WHEN c.quantidade_compo > 0 AND COALESCE(em.saldo, 0) > 0
      THEN FLOOR(COALESCE(em.saldo, 0) / c.quantidade_compo)
    ELSE 0
  END AS producoes_possiveis_por_materia,
  em.validade AS validade_materia,
  em.lote AS lote_materia,
  em.localizacao AS localizacao_materia
FROM public.erp_composicao_produto c
LEFT JOIN public.erp_estoque_distribuidora em
  ON em.cod_produto = c.materia_compo
 AND em.empresa_par = c.empresa_compo
LEFT JOIN public.erp_estoque_distribuidora pp
  ON pp.cod_produto = c.produto_compo
 AND pp.empresa_par = c.empresa_compo;

-- View agregada: capacidade produtiva por produto acabado (limitada pela matéria mais escassa)
CREATE OR REPLACE VIEW public.vw_composicao_capacidade_producao AS
SELECT
  empresa_compo,
  produto_compo,
  MAX(nome_produto_acabado) AS nome_produto_acabado,
  MAX(curva_produto_acabado) AS curva_produto_acabado,
  COUNT(*) AS qtd_materias,
  COUNT(*) FILTER (WHERE saldo_materia <= 0) AS materias_sem_estoque,
  MIN(producoes_possiveis_por_materia) AS producoes_possiveis,
  SUM(custo_unitario_composicao)::numeric(18,6) AS custo_total_composicao
FROM public.vw_composicao_estoque
GROUP BY empresa_compo, produto_compo;

-- RLS via grant (views herdam segurança das tabelas base)
GRANT SELECT ON public.vw_composicao_estoque TO authenticated;
GRANT SELECT ON public.vw_composicao_capacidade_producao TO authenticated;