import { z } from "zod";

// 11 estados fiéis ao enum WF do Notion
export const WF_VALUES = [
  "NÃO INICIADO",
  "INCOMPLETO",
  "AGUARDANDO INFORMAÇÃO",
  "NÃO RECEBIDO",
  "RECEBIDO",
  "EM ANDAMENTO",
  "AF ENVIADA",
  "EM APROVAÇÃO",
  "AF APROVADA",
  "OK",
  "APROVADO",
] as const;

export type WfValue = (typeof WF_VALUES)[number];

export const MARCAS = ["Ruby Rose", "Melu", "Union"] as const;

export const rrProdutoSchema = z
  .object({
    sku: z.string().min(1, "SKU obrigatório"),
    nome_comercial: z.string().min(1, "Nome obrigatório"),
    marca: z.string().nullable().optional(),
    categoria: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    linha_notion_id: z.string().nullable().optional(),
    composicao_pt: z.boolean().default(false),
    composicao_en: z.boolean().default(false),
    anvisa: z.string().nullable().optional(),
    ultima_revisao_regulatoria: z.string().nullable().optional(),
    wf: z.record(z.string(), z.string().nullable()).default({}),
  })
  .strict();

export type RrProdutoInput = z.infer<typeof rrProdutoSchema>;

export const rrLinhaSchema = z
  .object({
    nome: z.string().min(1, "Nome obrigatório"),
    marca: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .strict();

export type RrLinhaInput = z.infer<typeof rrLinhaSchema>;
