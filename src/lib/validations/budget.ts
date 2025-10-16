import { z } from "zod";

export const budgetSchema = z.object({
  name: z.string()
    .trim()
    .min(3, { message: "Nome deve ter no mínimo 3 caracteres" })
    .max(100, { message: "Nome deve ter no máximo 100 caracteres" })
    .regex(/^[a-zA-Z0-9\s\-\.\/]+$/, { message: "Nome contém caracteres inválidos" }),
  
  code: z.string()
    .trim()
    .min(2, { message: "Código deve ter no mínimo 2 caracteres" })
    .max(20, { message: "Código deve ter no máximo 20 caracteres" })
    .regex(/^[A-Z0-9\-]+$/, { message: "Código deve conter apenas letras maiúsculas, números e hífen" }),
  
  total_amount: z.number({
    required_error: "Valor total é obrigatório",
    invalid_type_error: "Valor deve ser um número",
  })
    .positive({ message: "Valor deve ser maior que zero" })
    .max(10000000, { message: "Valor não pode exceder R$ 10.000.000" })
    .multipleOf(0.01, { message: "Valor deve ter no máximo 2 casas decimais" }),
  
  period_start: z.date({
    required_error: "Data de início é obrigatória",
  }),
  
  period_end: z.date({
    required_error: "Data de fim é obrigatória",
  }),
  
  account_id: z.string()
    .uuid({ message: "ID da conta inválido" })
    .optional()
    .nullable(),
  
  description: z.string()
    .trim()
    .max(1000, { message: "Descrição deve ter no máximo 1000 caracteres" })
    .optional()
    .transform(val => val || ""),
  
  status: z.enum(["active", "inactive", "completed", "cancelled"])
    .default("active"),
}).refine(data => data.period_end > data.period_start, {
  message: "Data de fim deve ser posterior à data de início",
  path: ["period_end"],
});

export const chartOfAccountsSchema = z.object({
  name: z.string()
    .trim()
    .min(3, { message: "Nome deve ter no mínimo 3 caracteres" })
    .max(150, { message: "Nome deve ter no máximo 150 caracteres" })
    .regex(/^[a-zA-Z0-9\s\-\.\/\(\)]+$/, { message: "Nome contém caracteres inválidos" }),
  
  code: z.string()
    .trim()
    .min(1, { message: "Código é obrigatório" })
    .max(20, { message: "Código deve ter no máximo 20 caracteres" })
    .regex(/^[0-9\.]+$/, { message: "Código contábil deve conter apenas números e pontos (ex: 1.1.01)" }),
  
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
  
  description: z.string()
    .trim()
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" })
    .optional()
    .transform(val => val || ""),
  
  parent_account_id: z.string()
    .uuid({ message: "ID da conta pai inválido" })
    .optional()
    .nullable(),
  
  is_active: z.boolean()
    .default(true),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;
export type ChartOfAccountsFormData = z.infer<typeof chartOfAccountsSchema>;
