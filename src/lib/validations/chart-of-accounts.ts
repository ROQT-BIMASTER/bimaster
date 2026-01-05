import { z } from "zod";

export const chartOfAccountsSchema = z.object({
  code: z.string()
    .trim()
    .min(1, { message: "Código é obrigatório" })
    .max(20, { message: "Código deve ter no máximo 20 caracteres" })
    .regex(/^[0-9\.]+$/, { message: "Código contábil deve conter apenas números e pontos (ex: 1.1.01)" }),
  
  name: z.string()
    .trim()
    .min(3, { message: "Nome deve ter no mínimo 3 caracteres" })
    .max(150, { message: "Nome deve ter no máximo 150 caracteres" }),
  
  account_type: z.enum([
    "asset",
    "liability", 
    "expense",
    "revenue",
    "budget",
    "cost_center"
  ], { 
    errorMap: () => ({ message: "Tipo de conta inválido" }) 
  }),
  
  categoria_dre: z.enum([
    "receita_bruta",
    "deducoes",
    "custo_vendas",
    "despesas_variaveis",
    "despesas_fixas",
    "impostos_lucro"
  ]).optional().nullable(),
  
  nivel: z.number()
    .int()
    .min(1, { message: "Nível mínimo é 1" })
    .max(5, { message: "Nível máximo é 5" })
    .default(3),
  
  natureza: z.enum(["D", "C"], {
    errorMap: () => ({ message: "Natureza deve ser D (Débito) ou C (Crédito)" })
  }).default("D"),
  
  is_group: z.boolean().default(false),
  
  permite_lancamento: z.boolean().default(true),
  
  parent_account_id: z.string()
    .uuid({ message: "ID da conta pai inválido" })
    .optional()
    .nullable(),
  
  description: z.string()
    .trim()
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" })
    .optional()
    .transform(val => val || ""),
  
  is_active: z.boolean().default(true),
}).refine(data => {
  // Grupos não podem permitir lançamento
  if (data.is_group && data.permite_lancamento) {
    return false;
  }
  return true;
}, {
  message: "Contas de grupo não podem permitir lançamento direto",
  path: ["permite_lancamento"],
});

export type ChartOfAccountsFormData = z.infer<typeof chartOfAccountsSchema>;
