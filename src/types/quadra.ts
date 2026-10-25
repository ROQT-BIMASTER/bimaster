/** Tipos do módulo Quadra de Futebol (controle financeiro). */

export type QuadraTipoLancamento = "receita" | "despesa";
export type QuadraStatusLancamento = "pendente" | "pago" | "cancelado";
export type QuadraStatusReserva = "confirmada" | "realizada" | "cancelada";
export type QuadraStatusPagamento = "pendente" | "pago";
export type QuadraFormaPagamento =
  | "pix"
  | "dinheiro"
  | "cartao_credito"
  | "cartao_debito"
  | "transferencia"
  | "boleto"
  | "outro";

export interface QuadraLancamento {
  id: string;
  tipo: QuadraTipoLancamento;
  categoria: string;
  descricao: string;
  valor: number;
  /** Colunas DATE (YYYY-MM-DD) — usar parseLocalDate para converter. */
  data_competencia: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: QuadraStatusLancamento;
  forma_pagamento: QuadraFormaPagamento | null;
  reserva_id: string | null;
  mensalista_id: string | null;
  competencia_mensalidade: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuadraReserva {
  id: string;
  data: string;
  /** HH:MM:SS */
  horario_inicio: string;
  horario_fim: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  mensalista_id: string | null;
  valor: number;
  status: QuadraStatusReserva;
  status_pagamento: QuadraStatusPagamento;
  forma_pagamento: QuadraFormaPagamento | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuadraMensalista {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  /** 0 = domingo … 6 = sábado */
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  valor_mensal: number;
  dia_vencimento: number;
  ativo: boolean;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
