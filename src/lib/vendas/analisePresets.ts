import type { Metrica } from "@/lib/charts/corporateTheme";
import type { AnaliseChartTipo } from "@/components/vendas/AnaliseChart";

export type Dimensao =
  | "mes" | "trimestre" | "ano"
  | "vendedor" | "coordenador" | "cliente" | "empresa"
  | "tabela" | "tipo_pedido" | "produto";

export interface AnalisePreset {
  id: string;
  titulo: string;
  grupo: string;
  metrica: Metrica;
  dimensao: Dimensao;
  tipo: AnaliseChartTipo;
  descricao?: string;
}

export const METRICAS: { value: Metrica; label: string }[] = [
  { value: "faturamento", label: "Faturamento (R$)" },
  { value: "faturamento_impostos", label: "Faturamento c/ impostos" },
  { value: "quantidade", label: "Quantidade (un)" },
  { value: "notas", label: "Nº de notas" },
  { value: "ticket", label: "Ticket médio" },
  { value: "clientes", label: "Nº de clientes" },
  { value: "desconto", label: "Desconto (R$)" },
];

export const DIMENSOES: { value: Dimensao; label: string }[] = [
  { value: "mes", label: "Mês" },
  { value: "trimestre", label: "Trimestre" },
  { value: "ano", label: "Ano" },
  { value: "vendedor", label: "Vendedor" },
  { value: "coordenador", label: "Coordenador" },
  { value: "cliente", label: "Cliente" },
  { value: "empresa", label: "Empresa" },
  { value: "tabela", label: "Tabela de preço" },
  { value: "tipo_pedido", label: "Tipo de pedido" },
  { value: "produto", label: "Produto" },
];

export const PRESETS: AnalisePreset[] = [
  // Faturamento
  { id: "fat-mes-line", titulo: "Evolução mensal do faturamento", grupo: "Faturamento", metrica: "faturamento", dimensao: "mes", tipo: "line" },
  { id: "fat-trim-bar", titulo: "Faturamento por trimestre", grupo: "Faturamento", metrica: "faturamento", dimensao: "trimestre", tipo: "bar" },
  { id: "fat-ano-bar", titulo: "Faturamento por ano", grupo: "Faturamento", metrica: "faturamento", dimensao: "ano", tipo: "bar" },
  { id: "fat-vend-bar", titulo: "Faturamento por vendedor", grupo: "Faturamento", metrica: "faturamento", dimensao: "vendedor", tipo: "bar" },
  { id: "fat-coord-bar", titulo: "Faturamento por coordenador", grupo: "Faturamento", metrica: "faturamento", dimensao: "coordenador", tipo: "bar" },
  { id: "fat-emp-pie", titulo: "Faturamento por empresa", grupo: "Faturamento", metrica: "faturamento", dimensao: "empresa", tipo: "pie" },
  { id: "fat-tab-bar", titulo: "Faturamento por tabela de preço", grupo: "Faturamento", metrica: "faturamento", dimensao: "tabela", tipo: "bar" },
  { id: "fat-prod-bar", titulo: "Top produtos por faturamento", grupo: "Faturamento", metrica: "faturamento", dimensao: "produto", tipo: "bar" },
  { id: "fat-cli-bar", titulo: "Top clientes por faturamento", grupo: "Faturamento", metrica: "faturamento", dimensao: "cliente", tipo: "bar" },
  { id: "fat-tipo-bar", titulo: "Faturamento por tipo de pedido", grupo: "Faturamento", metrica: "faturamento", dimensao: "tipo_pedido", tipo: "bar" },
  { id: "fat-tab-tree", titulo: "Mix de faturamento por tabela (treemap)", grupo: "Faturamento", metrica: "faturamento", dimensao: "tabela", tipo: "treemap" },
  { id: "fat-vend-tree", titulo: "Mix de faturamento por vendedor (treemap)", grupo: "Faturamento", metrica: "faturamento", dimensao: "vendedor", tipo: "treemap" },

  // Faturamento com impostos
  { id: "fati-mes-line", titulo: "Faturamento c/ impostos por mês", grupo: "Faturamento c/ impostos", metrica: "faturamento_impostos", dimensao: "mes", tipo: "line" },
  { id: "fati-vend-bar", titulo: "Faturamento c/ impostos por vendedor", grupo: "Faturamento c/ impostos", metrica: "faturamento_impostos", dimensao: "vendedor", tipo: "bar" },
  { id: "fati-emp-pie", titulo: "Faturamento c/ impostos por empresa", grupo: "Faturamento c/ impostos", metrica: "faturamento_impostos", dimensao: "empresa", tipo: "pie" },

  // Quantidade
  { id: "qt-prod-bar", titulo: "Top produtos por quantidade (un)", grupo: "Quantidade", metrica: "quantidade", dimensao: "produto", tipo: "bar" },
  { id: "qt-tab-bar", titulo: "Quantidade (un) por tabela", grupo: "Quantidade", metrica: "quantidade", dimensao: "tabela", tipo: "bar" },
  { id: "qt-mes-line", titulo: "Quantidade (un) por mês", grupo: "Quantidade", metrica: "quantidade", dimensao: "mes", tipo: "line" },
  { id: "qt-vend-bar", titulo: "Quantidade (un) por vendedor", grupo: "Quantidade", metrica: "quantidade", dimensao: "vendedor", tipo: "bar" },
  { id: "qt-coord-bar", titulo: "Quantidade (un) por coordenador", grupo: "Quantidade", metrica: "quantidade", dimensao: "coordenador", tipo: "bar" },
  { id: "qt-cli-bar", titulo: "Quantidade (un) por cliente (top)", grupo: "Quantidade", metrica: "quantidade", dimensao: "cliente", tipo: "bar" },
  { id: "qt-tab-tree", titulo: "Mix de quantidade por tabela (treemap)", grupo: "Quantidade", metrica: "quantidade", dimensao: "tabela", tipo: "treemap" },

  // Ticket médio
  { id: "tic-vend-bar", titulo: "Ticket médio por vendedor", grupo: "Ticket médio", metrica: "ticket", dimensao: "vendedor", tipo: "bar" },
  { id: "tic-cli-bar", titulo: "Ticket médio por cliente (top)", grupo: "Ticket médio", metrica: "ticket", dimensao: "cliente", tipo: "bar" },
  { id: "tic-mes-line", titulo: "Ticket médio por mês", grupo: "Ticket médio", metrica: "ticket", dimensao: "mes", tipo: "line" },
  { id: "tic-emp-bar", titulo: "Ticket médio por empresa", grupo: "Ticket médio", metrica: "ticket", dimensao: "empresa", tipo: "bar" },
  { id: "tic-tab-bar", titulo: "Ticket médio por tabela", grupo: "Ticket médio", metrica: "ticket", dimensao: "tabela", tipo: "bar" },

  // Notas
  { id: "nf-vend-bar", titulo: "Nº de notas por vendedor", grupo: "Nº de notas", metrica: "notas", dimensao: "vendedor", tipo: "bar" },
  { id: "nf-mes-line", titulo: "Nº de notas por mês", grupo: "Nº de notas", metrica: "notas", dimensao: "mes", tipo: "line" },
  { id: "nf-emp-pie", titulo: "Nº de notas por empresa", grupo: "Nº de notas", metrica: "notas", dimensao: "empresa", tipo: "pie" },
  { id: "nf-tab-bar", titulo: "Nº de notas por tabela", grupo: "Nº de notas", metrica: "notas", dimensao: "tabela", tipo: "bar" },
  { id: "nf-coord-bar", titulo: "Nº de notas por coordenador", grupo: "Nº de notas", metrica: "notas", dimensao: "coordenador", tipo: "bar" },
  { id: "nf-cli-bar", titulo: "Top clientes por nº de notas", grupo: "Nº de notas", metrica: "notas", dimensao: "cliente", tipo: "bar" },

  // Clientes
  { id: "cl-vend-bar", titulo: "Clientes atendidos por vendedor", grupo: "Clientes", metrica: "clientes", dimensao: "vendedor", tipo: "bar" },
  { id: "cl-mes-line", titulo: "Clientes atendidos por mês", grupo: "Clientes", metrica: "clientes", dimensao: "mes", tipo: "line" },
  { id: "cl-tab-bar", titulo: "Clientes atendidos por tabela", grupo: "Clientes", metrica: "clientes", dimensao: "tabela", tipo: "bar" },
  { id: "cl-emp-bar", titulo: "Clientes atendidos por empresa", grupo: "Clientes", metrica: "clientes", dimensao: "empresa", tipo: "bar" },
  { id: "cl-coord-bar", titulo: "Clientes atendidos por coordenador", grupo: "Clientes", metrica: "clientes", dimensao: "coordenador", tipo: "bar" },

  // Desconto
  { id: "ds-vend-bar", titulo: "Desconto concedido por vendedor", grupo: "Desconto", metrica: "desconto", dimensao: "vendedor", tipo: "bar" },
  { id: "ds-cli-bar", titulo: "Top clientes por desconto", grupo: "Desconto", metrica: "desconto", dimensao: "cliente", tipo: "bar" },
  { id: "ds-tab-bar", titulo: "Desconto por tabela", grupo: "Desconto", metrica: "desconto", dimensao: "tabela", tipo: "bar" },
  { id: "ds-mes-line", titulo: "Desconto concedido por mês", grupo: "Desconto", metrica: "desconto", dimensao: "mes", tipo: "line" },
  { id: "ds-prod-bar", titulo: "Top produtos por desconto", grupo: "Desconto", metrica: "desconto", dimensao: "produto", tipo: "bar" },

  // Mix & rankings
  { id: "mix-tab-pie", titulo: "Mix de vendas por tabela", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "tabela", tipo: "pie" },
  { id: "mix-emp-pie", titulo: "Mix de vendas por empresa", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "empresa", tipo: "pie" },
  { id: "mix-coord-pie", titulo: "Mix de vendas por coordenador", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "coordenador", tipo: "pie" },
  { id: "rank-cli-bar", titulo: "Top 20 clientes (faturamento)", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "cliente", tipo: "bar" },
  { id: "rank-prod-bar", titulo: "Top 20 produtos (faturamento)", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "produto", tipo: "bar" },
  { id: "rank-prod-qt", titulo: "Top 20 produtos (quantidade)", grupo: "Mix & rankings", metrica: "quantidade", dimensao: "produto", tipo: "bar" },
  { id: "rank-vend-bar", titulo: "Ranking de vendedores", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "vendedor", tipo: "bar" },
  { id: "rank-coord-bar", titulo: "Ranking de coordenadores", grupo: "Mix & rankings", metrica: "faturamento", dimensao: "coordenador", tipo: "bar" },
];
