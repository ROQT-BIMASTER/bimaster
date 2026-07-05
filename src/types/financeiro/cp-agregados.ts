// Payloads das RPCs agregadas de Contas a Pagar (fonte única dos números da tela).
// fn_cp_dashboard / fn_cp_kpis_avancados / fn_cp_calendario — ver migration 20260704231038.
// Campos opcionais (por_departamento, valor_original em por_status, pago_mes_atual) chegam com a RPC v2.

export interface CpQtdValor {
  qtd: number;
  valor: number;
}

export interface CpDashboardPayload {
  provisionado_aberto: number;
  lancado_aberto: number;
  total_aberto: number;
  qtd_aberto: number;
  vence_hoje: CpQtdValor;
  vence_7d: CpQtdValor;
  vence_30d: CpQtdValor;
  vencido_30_mais: CpQtdValor;
  vencido_total: CpQtdValor;
  por_status: Array<{ status: string; qtd: number; valor: number; valor_original?: number }>;
  por_natureza: Array<{ natureza_lancamento: string; qtd: number; valor: number }>;
  top_fornecedores: Array<{ fornecedor_nome: string; valor: number; qtd: number }>;
  evolucao_mensal: Array<{ mes: string; pago: number; aberto: number; original: number }>;
  /** Disponível após a RPC v2 (prompt Lovable) — até lá o gráfico mostra estado vazio. */
  por_departamento?: Array<{ departamento_nome: string | null; valor: number }>;
  /** RPC v2 */
  pago_mes_atual?: number;
}

export interface CpKpisPayload {
  pmp_dias_aprox: number;
  pontualidade_pct_aprox: number;
  /** true enquanto data_pagamento não passou pela validação da Fase 2b */
  aproximado: boolean;
  concentracao_7d: number;
  concentracao_15d: number;
  concentracao_30d: number;
  total_mes_atual: number;
  total_mes_anterior: number;
  variacao_mensal_pct: number;
}

export interface CpCalendarioBucket {
  dia: string; // YYYY-MM-DD
  qtd: number;
  valor_aberto: number;
  valor_original: number;
  valor_pago: number;
}
