/**
 * Single source of truth for AP (Contas a Pagar) domain types.
 *
 * Replaces redundant local `interface ContaPagar` declarations across:
 *  - src/pages/ContasAPagar.tsx
 *  - src/components/financeiro/CalendarioVencimentos.tsx
 *  - src/components/financeiro/ContasPagarDREView.tsx
 *
 * Mirrors the canonical shape returned by Edge Function `contas-pagar-api`
 * (`/query`, `/listar`, `/consultar`) and the SDK enums published in
 * `src/components/erp/SdkDownloadButtons.tsx`.
 */

// =====================================================
// Enums (paridade com SDK público)
// =====================================================
export enum StatusTitulo {
  PENDENTE = "PENDENTE",
  PAGO = "PAGO",
  VENCIDO = "VENCIDO",
  CANCELADO = "CANCELADO",
}

export enum TipoDocumento {
  NF = "NF",
  NFE = "NFE",
  NFS = "NFS",
  NFSE = "NFSE",
  BOLETO = "BOLETO",
  RECIBO = "RECIBO",
  CONTRATO = "CONTRATO",
  OUTROS = "OUTROS",
}

// =====================================================
// Entidade principal — espelha o retorno do backend
// =====================================================
export interface ContaPagar {
  id: string;
  erp_id: string;
  empresa_id: number;
  empresa_nome: string;
  tipo_documento: string;
  numero_documento: string;
  parcela: number;
  fornecedor_codigo: string;
  fornecedor_nome: string;
  valor_original: number;
  valor_aberto: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  categoria_nome: string;
  status: string;
  portador: string;
  conta: string;
  departamento_id: string | null;
  departamento_nome: string | null;
  plano_contas_id: string | null;
  plano_contas_codigo: string | null;
  plano_contas_nome: string | null;
  confianca_classificacao: number | null;
  classificacao_justificativa: string | null;
  classificado_automaticamente: boolean | null;
  classificado_em: string | null;
  classificacao_manual: boolean | null;
  classificacao_corrigida_por: string | null;
  classificacao_corrigida_em: string | null;
}

// =====================================================
// Projections — variantes reduzidas usadas em telas específicas
// =====================================================

/** Subset usado em `CalendarioVencimentos`. */
export type ContaPagarCalendario = Pick<
  ContaPagar,
  | "id"
  | "fornecedor_nome"
  | "numero_documento"
  | "parcela"
  | "valor_original"
  | "valor_aberto"
  | "data_vencimento"
  | "status"
  | "empresa_nome"
  | "departamento_nome"
> & { portador: string | null };

/** Subset usado em `ContasPagarDREView`. */
export type ContaPagarDRE = Pick<
  ContaPagar,
  | "id"
  | "fornecedor_nome"
  | "categoria_nome"
  | "valor_original"
  | "data_vencimento"
  | "departamento_id"
  | "departamento_nome"
  | "plano_contas_id"
  | "plano_contas_codigo"
  | "plano_contas_nome"
  | "classificado_automaticamente"
  | "classificacao_manual"
  | "confianca_classificacao"
>;

// =====================================================
// Pagamento (lancamento de baixa)
// =====================================================
export interface Pagamento {
  id: string;
  conta_pagar_id: string;
  codigo_lancamento?: string | null;
  codigo_baixa_integracao?: string | null;
  codigo_conta_corrente?: string | null;
  valor: number;
  desconto?: number | null;
  juros?: number | null;
  multa?: number | null;
  data: string;
  observacao?: string | null;
  forma_pagamento?:
    | "dinheiro"
    | "cheque"
    | "pix"
    | "boleto"
    | "cartao"
    | "transferencia"
    | "API"
    | null;
  codigo_pix?: string | null;
}

// =====================================================
// Parcela
// =====================================================
export interface Parcela {
  id: string;
  conta_pagar_id: string;
  numero: number;
  valor: number;
  valor_aberto: number;
  data_vencimento: string;
  status: string;
}

// =====================================================
// Inputs (mirror dos schemas Zod do backend)
// =====================================================
export interface IncluirContaPagarInput {
  codigo_lancamento_integracao: string;
  codigo_cliente_fornecedor?: string;
  data_vencimento: string;
  valor_documento: number;
  codigo_categoria?: string;
  data_previsao?: string;
  id_conta_corrente?: string;
  empresa_id?: number;
  descricao?: string;
  observacao?: string;
  numero_documento?: string;
  tipo_documento?: string;
  data_emissao?: string;
  fornecedor_nome?: string;
  fornecedor_codigo?: string;
  categoria_nome?: string;
  portador?: string;
  conta?: string;
  parcela?: string | number;
  data_entrada?: string;
  codigo_projeto?: string;
  numero_documento_fiscal?: string;
  chave_nfe?: string;
  codigo_tipo_documento?: string;
  numero_pedido?: string;
}

export interface UpsertContaPagarInput
  extends Partial<Omit<IncluirContaPagarInput, "codigo_lancamento_integracao">> {
  codigo_lancamento_integracao: string;
  valor_aberto?: number;
  status?: string;
}

export interface LancarPagamentoInput {
  codigo_lancamento?: string | number;
  codigo_lancamento_integracao?: string;
  codigo_baixa_integracao?: string;
  codigo_conta_corrente?: string;
  valor: number;
  desconto?: number;
  juros?: number;
  multa?: number;
  data?: string;
  observacao?: string;
  conciliar_documento?: string;
  forma_pagamento?:
    | "dinheiro"
    | "cheque"
    | "pix"
    | "boleto"
    | "cartao"
    | "transferencia"
    | "API";
  codigo_pix?: string;
}

export interface EstornarInput {
  id: string;
  motivo: string;
  valor_estorno?: number;
}

export interface QueryParams {
  empresa_id?: string;
  fornecedor_codigo?: string;
  status?: string;
  vencimento_de?: string;
  vencimento_ate?: string;
  emissao_de?: string;
  emissao_ate?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  order_dir?: "asc" | "desc" | "";
  cursor?: string;
}

// =====================================================
// API envelope
// =====================================================
export interface ApiMeta {
  request_id?: string;
  duration_ms?: number;
  total?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface ApiResponse<T> {
  data?: T;
  rows?: T;
  meta?: ApiMeta;
  error?: string;
  message?: string;
}
