
-- Tabela vendas_union: histórico de vendas no nível de item do pedido
CREATE TABLE public.vendas_union (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_empresa int,
  empresa text,
  pedido int,
  data timestamp with time zone,
  nota int,
  operacao text,
  cod_cliente int,
  cliente text,
  id_ramo int,
  ramo text,
  cidade text,
  uf text,
  tp_venda text,
  tp_nfe text,
  cod_produto int,
  descricao text,
  marca text,
  quantidade numeric,
  preco_venda numeric,
  vl_desconto numeric,
  vl_icm_subst numeric,
  vl_cmv numeric,
  vl_outros_custos numeric,
  tabela text,
  cod_vend int,
  vendedor text,
  cod_equipe int,
  nome_equipe text,
  supervisor text,
  nome_linha text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_vendas_union_empresa_pedido ON public.vendas_union (id_empresa, pedido);
CREATE INDEX idx_vendas_union_empresa_nota ON public.vendas_union (id_empresa, nota);
CREATE INDEX idx_vendas_union_data ON public.vendas_union (data);
CREATE INDEX idx_vendas_union_cod_cliente ON public.vendas_union (cod_cliente);
CREATE INDEX idx_vendas_union_cod_produto ON public.vendas_union (cod_produto);
CREATE INDEX idx_vendas_union_cod_vend ON public.vendas_union (cod_vend);
CREATE INDEX idx_vendas_union_operacao ON public.vendas_union (operacao);

-- RLS desabilitado conforme solicitado
ALTER TABLE public.vendas_union DISABLE ROW LEVEL SECURITY;
