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
