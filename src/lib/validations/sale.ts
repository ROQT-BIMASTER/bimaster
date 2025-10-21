import { z } from "zod";

export const saleItemSchema = z.object({
  product_name: z.string().min(1, "Nome do produto é obrigatório"),
  product_code: z.string().optional(),
  quantity: z.coerce.number().positive("Quantidade deve ser positiva"),
  unit_price: z.coerce.number().positive("Preço unitário deve ser positivo"),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  unit_of_measure: z.string().default("UN"),
  notes: z.string().optional(),
});

export const saleSchema = z.object({
  sale_code: z.string().min(1, "Código da venda é obrigatório"),
  sale_date: z.string().min(1, "Data da venda é obrigatória"),
  store_id: z.string().uuid().optional(),
  prospect_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  salesperson_id: z.string().uuid().optional(),
  payment_method: z.string().optional(),
  payment_terms: z.string().optional(),
  delivery_date: z.string().optional(),
  converted_from_prospect: z.boolean().default(false),
  status: z.enum(["pending", "approved", "rejected", "completed", "cancelled"]).default("pending"),
  notes: z.string().optional(),
}).refine((data) => data.store_id || data.prospect_id, {
  message: "Selecione uma loja ou prospect",
  path: ["store_id"],
});

export type SaleFormData = z.infer<typeof saleSchema>;
export type SaleItemFormData = z.infer<typeof saleItemSchema>;
