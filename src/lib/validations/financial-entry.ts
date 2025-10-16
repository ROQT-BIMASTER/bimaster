import { z } from "zod";

export const financialEntrySchema = z.object({
  entry_date: z.date({
    required_error: "Data do lançamento é obrigatória",
  })
    .max(new Date(), { message: "Data não pode ser futura" }),
  
  account_id: z.string()
    .uuid({ message: "ID da conta inválido" }),
  
  entry_type: z.enum([
    "budget_allocation",
    "investment",
    "expense",
    "revenue",
    "adjustment"
  ], { 
    errorMap: () => ({ message: "Tipo de lançamento inválido" }) 
  }),
  
  amount: z.number({
    required_error: "Valor é obrigatório",
    invalid_type_error: "Valor deve ser um número",
  })
    .positive({ message: "Valor deve ser maior que zero" })
    .max(1000000, { message: "Valor não pode exceder R$ 1.000.000" })
    .multipleOf(0.01, { message: "Valor deve ter no máximo 2 casas decimais" }),
  
  description: z.string()
    .trim()
    .min(5, { message: "Descrição deve ter no mínimo 5 caracteres" })
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" }),
  
  reference_number: z.string()
    .trim()
    .max(50, { message: "Número de referência deve ter no máximo 50 caracteres" })
    .regex(/^[A-Z0-9\-\/]+$/, { message: "Número de referência contém caracteres inválidos" })
    .optional(),
  
  store_id: z.string()
    .uuid({ message: "ID da loja inválido" })
    .optional()
    .nullable(),
  
  investment_id: z.string()
    .uuid({ message: "ID do investimento inválido" })
    .optional()
    .nullable(),
  
  budget_id: z.string()
    .uuid({ message: "ID da verba inválido" })
    .optional()
    .nullable(),
  
  status: z.enum(["pending", "approved", "rejected", "completed"])
    .default("pending"),
  
  notes: z.string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional()
    .transform(val => val || ""),
  
  document_url: z.string()
    .url({ message: "URL do documento inválida" })
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type FinancialEntryFormData = z.infer<typeof financialEntrySchema>;
