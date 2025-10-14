import { z } from "zod";

export const investmentSchema = z.object({
  store_id: z.string()
    .uuid({ message: "ID da loja inválido" }),
  visit_id: z.string()
    .uuid({ message: "ID da visita inválido" })
    .optional(),
  category: z.enum([
    "gondola_material",
    "pos_material", 
    "refrigerator",
    "freezer",
    "display",
    "shelf",
    "signage",
    "promotional_material",
    "equipment",
    "other"
  ], { 
    errorMap: () => ({ message: "Categoria de investimento inválida" }) 
  }),
  investment_date: z.date({
    required_error: "Data do investimento é obrigatória",
  }),
  amount: z.number({
    required_error: "Valor é obrigatório",
  })
    .positive({ message: "Valor deve ser maior que zero" })
    .max(1000000, { message: "Valor não pode exceder R$ 1.000.000" }),
  description: z.string()
    .trim()
    .min(5, { message: "Descrição deve ter no mínimo 5 caracteres" })
    .max(500, { message: "Descrição deve ter no máximo 500 caracteres" })
    .optional(),
  payment_method: z.enum(["cash", "credit_card", "debit_card", "transfer", "check", "other"])
    .optional(),
  status: z.enum(["pending", "approved", "rejected", "completed"])
    .default("pending"),
  notes: z.string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional(),
  receipt_url: z.string()
    .url({ message: "URL do comprovante inválida" })
    .optional()
    .or(z.literal("")),
});

export type InvestmentFormData = z.infer<typeof investmentSchema>;
