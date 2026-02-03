import { z } from "zod";

export const campaignSchema = z.object({
  code: z.string()
    .trim()
    .min(3, { message: "Código deve ter no mínimo 3 caracteres" })
    .max(50, { message: "Código deve ter no máximo 50 caracteres" })
    .regex(/^[A-Z0-9\-]+$/, { message: "Código deve conter apenas letras maiúsculas, números e hífens" }),
  
  name: z.string()
    .trim()
    .min(5, { message: "Nome deve ter no mínimo 5 caracteres" })
    .max(255, { message: "Nome deve ter no máximo 255 caracteres" }),
  
  description: z.string()
    .trim()
    .max(1000, { message: "Descrição deve ter no máximo 1000 caracteres" })
    .optional(),
  
  campaign_type: z.enum([
    "sell_in",
    "sell_out",
    "institucional",
    "cooperada",
    "mdf",
    "midia",
    "incentivo",
    "degustacao",
    "bonificacao"
  ], { 
    errorMap: () => ({ message: "Tipo de campanha inválido" }) 
  }),
  
  budget_id: z.string()
    .uuid({ message: "Selecione uma verba aprovada" }),
  
  estimated_cost: z.number({
    required_error: "Custo estimado é obrigatório",
    invalid_type_error: "Custo deve ser um número",
  })
    .positive({ message: "Custo deve ser maior que zero" })
    .max(10000000, { message: "Custo não pode exceder R$ 10.000.000" })
    .multipleOf(0.01, { message: "Custo deve ter no máximo 2 casas decimais" }),
  
  target_revenue: z.number()
    .positive({ message: "Receita alvo deve ser maior que zero" })
    .max(100000000, { message: "Receita não pode exceder R$ 100.000.000" })
    .optional()
    .nullable(),
  
  start_date: z.date({
    required_error: "Data de início é obrigatória",
  }),
  
  end_date: z.date({
    required_error: "Data de fim é obrigatória",
  }),
  
  region: z.string()
    .trim()
    .max(100, { message: "Região deve ter no máximo 100 caracteres" })
    .optional(),
  
  target_stores: z.array(z.string().uuid())
    .optional(),
  
  responsible_user_id: z.string()
    .uuid({ message: "Responsável inválido" }),
});

export type CampaignFormData = z.infer<typeof campaignSchema>;
