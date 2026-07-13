// _shared/contas-pagar/types.ts — Zod schemas + shared interfaces
import { z } from "https://esm.sh/zod@3.22.4";
import { createClient } from "npm:@supabase/supabase-js@2";

// =====================================================
// Shared transforms
// =====================================================
export const strOrNum = z.union([z.string(), z.number()]).transform(String);
export const strOrNumOpt = z.union([z.string(), z.number()]).transform(String).optional();

// =====================================================
// ZOD SCHEMAS — Mass Assignment protection (SEG)
// =====================================================
export const IncluirSchema = z.object({
  codigo_lancamento_integracao: strOrNum,
  codigo_cliente_fornecedor: strOrNumOpt,
  data_vencimento: z.string().min(1),
  valor_documento: z.number(),
  codigo_categoria: strOrNumOpt,
  data_previsao: z.string().optional(),
  id_conta_corrente: strOrNumOpt,
  empresa_id: z.preprocess((v) => v != null ? Number(v) : undefined, z.number().int().optional()),
  descricao: z.string().optional(),
  observacao: z.string().optional(),
  numero_documento: strOrNumOpt,
  tipo_documento: z.string().optional(),
  data_emissao: z.string().optional(),
  fornecedor_nome: z.string().optional(),
  fornecedor_codigo: z.string().optional(),
  categoria_nome: z.string().optional(),
  portador: z.string().optional(),
  conta: z.string().optional(),
  parcela: z.union([z.string(), z.number()]).optional(),
  data_entrada: z.string().optional(),
  codigo_projeto: strOrNumOpt,
  // PR-23 (v4.4.0): novos campos fiscais/documentais aceitos pelo runtime
  numero_documento_fiscal: strOrNumOpt,
  chave_nfe: z.string().optional(),
  codigo_tipo_documento: strOrNumOpt,
  numero_pedido: strOrNumOpt,
  // Passo 1a — nascimento correto: departamento (UUID), plano de contas (FK) e
  // natureza orçamentária. Sem isso o .strict() rejeitava o payload da tela.
  // (projeto = a coluna real em contas_pagar é codigo_projeto INTEGER, não um UUID projeto_id
  //  → deferido até definir o mapeamento; parcelamento = quantidade_parcelas fica p/ o 1a-ii.)
  departamento_id: z.string().uuid().optional(),
  plano_contas_id: z.string().uuid().optional(),
  natureza_lancamento: z.enum(['provisionado', 'lancado']).optional(),
}).strict();

// AlterarSchema removido em v4.0.0 (PR-7) — use UpsertSchema via /upsert.

export const UpsertSchema = z.object({
  codigo_lancamento_integracao: strOrNum,
  empresa_id: z.preprocess((v) => v != null ? Number(v) : undefined, z.number().int().optional()),
  valor_documento: z.number().optional(),
  valor_aberto: z.number().optional(),
  data_vencimento: z.string().optional(),
  data_previsao: z.string().optional(),
  data_emissao: z.string().optional(),
  data_entrada: z.string().optional(),
  descricao: z.string().optional(),
  observacao: z.string().optional(),
  codigo_categoria: strOrNumOpt,
  categoria_nome: z.string().optional(),
  id_conta_corrente: strOrNumOpt,
  status: z.string().optional(),
  fornecedor_nome: z.string().optional(),
  fornecedor_codigo: z.string().optional(),
  codigo_cliente_fornecedor: strOrNumOpt,
  portador: z.string().optional(),
  conta: z.string().optional(),
  numero_documento: strOrNumOpt,
  tipo_documento: z.string().optional(),
  parcela: z.union([z.string(), z.number()]).optional(),
  // PR-23 (v4.4.0): paridade com IncluirSchema — destrava persistência de novos campos
  codigo_projeto: strOrNumOpt,
  numero_documento_fiscal: strOrNumOpt,
  chave_nfe: z.string().optional(),
  codigo_tipo_documento: strOrNumOpt,
  numero_pedido: strOrNumOpt,
  // Passo 1a — nascimento correto: departamento (UUID), plano de contas (FK) e
  // natureza orçamentária. Sem isso o .strict() rejeitava o payload da tela.
  // (projeto = a coluna real em contas_pagar é codigo_projeto INTEGER, não um UUID projeto_id
  //  → deferido até definir o mapeamento; parcelamento = quantidade_parcelas fica p/ o 1a-ii.)
  departamento_id: z.string().uuid().optional(),
  plano_contas_id: z.string().uuid().optional(),
  natureza_lancamento: z.enum(['provisionado', 'lancado']).optional(),
}).strict();

export const LancarPagamentoSchema = z.object({
  codigo_lancamento: z.union([z.string(), z.number()]).optional(),
  codigo_lancamento_integracao: strOrNumOpt,
  codigo_baixa_integracao: strOrNumOpt,
  codigo_conta_corrente: strOrNumOpt,
  valor: z.number(),
  desconto: z.number().optional(),
  juros: z.number().optional(),
  multa: z.number().optional(),
  data: z.string().optional(),
  observacao: z.string().optional(),
  conciliar_documento: z.string().optional(),
  // PR-23 (v4.4.0): forma_pagamento enum + codigo_pix (paridade com telas do ERP)
  forma_pagamento: z.enum(['dinheiro','cheque','pix','boleto','cartao','transferencia','API']).optional(),
  codigo_pix: z.string().max(255).optional(),
}).strict();

// CancelarPagamentoSchema removido em v4.0.0 (PR-7) — use EstornarSchema via /estornar.

// =====================================================
// Zod schemas — previously unvalidated endpoints (Fase 2C)
// =====================================================
export const EstornarSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().min(1).max(500),
  valor_estorno: z.number().positive().optional(),
}).strict();

// RegistrarPagamentoSchema removido em v4.0.0 (PR-7) — use LancarPagamentoSchema via /lancar-pagamento.

// =====================================================
// Zod schemas — GET query params validation (Fase 2B)
// =====================================================
const positiveInt = z.coerce.number().int().positive().optional();
const nonNegativeInt = z.coerce.number().int().nonnegative().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD').optional();
const uuidOpt = z.string().uuid().optional();

// ListarParamsSchema removido em v4.0.0 (PR-7) — use QueryParamsSchema via /query.

export const QueryParamsSchema = z.object({
  empresa_id: z.string().max(20).optional(),
  empresa_ids: z.string().max(500).optional(), // csv (1..N)
  fornecedor_codigo: z.string().max(100).optional(),
  status: z.string().max(200).optional(),
  vencimento_de: dateStr,
  vencimento_ate: dateStr,
  emissao_de: dateStr,
  emissao_ate: dateStr,
  departamento_id: z.string().uuid().optional(),
  portadores: z.string().max(2000).optional(), // csv
  natureza_lancamento: z.enum(['provisionado', 'lancado']).optional(),
  centro_custo_id: z.string().uuid().optional(),
  plano_contas_id: z.string().uuid().optional(),
  search: z.string().max(200).optional(), // ilike sobre fornecedor_nome / numero_documento
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: nonNegativeInt.default(0),
  order_by: z.string().max(50).default('data_vencimento'),
  order_dir: z.enum(['asc', 'desc', '']).default(''),
  cursor: uuidOpt,
});

export const ConsultarParamsSchema = z.object({
  id: uuidOpt,
  codigo_lancamento_integracao: z.string().max(200).optional(),
  codigo_lancamento_huggs: z.string().max(200).optional(),
});

export const PagamentosParamsSchema = z.object({
  conta_pagar_id: uuidOpt,
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: nonNegativeInt.default(0),
  cursor: uuidOpt,
});

// =====================================================
// Handler context
// =====================================================
export interface HandlerContext {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  req: Request;
  url: URL;
  startTime: number;
  corsHeaders: Record<string, string>;
  validateAuth: () => Promise<boolean>;
  validateApiKey: () => Promise<boolean>;
  // Auth info populated by validateAuth (may be undefined until validateAuth is called).
  authSource?: "jwt" | "api_key" | null;
  authUserId?: string;
  // deno-lint-ignore no-explicit-any
  getEmpresaScope?: () => Promise<import("../empresa-scope.ts").EmpresaScope>;
}
