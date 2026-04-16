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
}).strict();

export const AlterarSchema = z.object({
  codigo_lancamento_integracao: strOrNumOpt,
  codigo_lancamento_huggs: z.union([z.string(), z.number()]).optional(),
  valor_documento: z.number().optional(),
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
  portador: z.string().optional(),
  conta: z.string().optional(),
  codigo_cliente_fornecedor: strOrNumOpt,
}).strict();

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
}).strict();

export const CancelarPagamentoSchema = z.object({
  codigo_baixa: strOrNumOpt,
  codigo_baixa_integracao: strOrNumOpt,
}).strict();

// =====================================================
// Zod schemas — previously unvalidated endpoints (Fase 2C)
// =====================================================
export const EstornarSchema = z.object({
  id: z.string().uuid(),
  motivo: z.string().min(1).max(500),
  valor_estorno: z.number().positive().optional(),
}).strict();

export const RegistrarPagamentoSchema = z.object({
  conta_pagar_id: z.string().uuid(),
  valor_pago: z.number().positive(),
  data_pagamento: z.string().optional(),
  metodo_pagamento: z.string().max(50).optional(),
  observacao: z.string().max(500).optional(),
}).strict();

// =====================================================
// Zod schemas — GET query params validation (Fase 2B)
// =====================================================
const positiveInt = z.coerce.number().int().positive().optional();
const nonNegativeInt = z.coerce.number().int().nonnegative().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD').optional();
const uuidOpt = z.string().uuid().optional();

export const ListarParamsSchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  registros_por_pagina: z.coerce.number().int().min(1).max(500).default(20),
  filtrar_por_status: z.string().max(200).optional(),
  filtrar_por_data_de: dateStr,
  filtrar_por_data_ate: dateStr,
  filtrar_por_emissao_de: dateStr,
  filtrar_por_emissao_ate: dateStr,
  filtrar_conta_corrente: z.string().max(100).optional(),
  filtrar_cliente: z.string().max(100).optional(),
  filtrar_por_cpf_cnpj: z.string().max(20).optional(),
  filtrar_por_projeto: z.string().max(100).optional(),
  filtrar_por_vendedor: z.string().max(100).optional(),
  ordenar_por: z.string().max(50).default('data_vencimento'),
  ordem_descrescente: z.enum(['S', 'N', '']).default(''),
  apenas_importado_api: z.enum(['S', 'N', '']).default(''),
  exibir_obs: z.enum(['S', 'N', '']).default(''),
});

export const QueryParamsSchema = z.object({
  empresa_id: z.string().max(20).optional(),
  fornecedor_codigo: z.string().max(100).optional(),
  status: z.string().max(200).optional(),
  vencimento_de: dateStr,
  vencimento_ate: dateStr,
  emissao_de: dateStr,
  emissao_ate: dateStr,
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
  supabase: ReturnType<typeof createClient>;
  req: Request;
  url: URL;
  startTime: number;
  corsHeaders: Record<string, string>;
  validateAuth: () => Promise<boolean>;
  validateApiKey: () => Promise<boolean>;
}
