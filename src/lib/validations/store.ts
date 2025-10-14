import { z } from "zod";

export const storeSchema = z.object({
  code: z.string()
    .trim()
    .min(1, { message: "Código é obrigatório" })
    .max(50, { message: "Código deve ter no máximo 50 caracteres" }),
  name: z.string()
    .trim()
    .min(1, { message: "Nome é obrigatório" })
    .max(200, { message: "Nome deve ter no máximo 200 caracteres" }),
  chain: z.string()
    .trim()
    .max(100, { message: "Rede deve ter no máximo 100 caracteres" })
    .optional(),
  cnpj: z.string()
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/, { 
      message: "CNPJ inválido. Use formato 00.000.000/0000-00 ou 14 dígitos" 
    })
    .optional()
    .or(z.literal("")),
  address: z.string()
    .trim()
    .max(500, { message: "Endereço deve ter no máximo 500 caracteres" })
    .optional(),
  city: z.string()
    .trim()
    .max(100, { message: "Cidade deve ter no máximo 100 caracteres" })
    .optional(),
  state: z.string()
    .trim()
    .length(2, { message: "Estado deve ter 2 caracteres (UF)" })
    .optional()
    .or(z.literal("")),
  zip_code: z.string()
    .trim()
    .regex(/^\d{5}-?\d{3}$/, { message: "CEP inválido. Use formato 00000-000" })
    .optional()
    .or(z.literal("")),
  phone: z.string()
    .trim()
    .max(20, { message: "Telefone deve ter no máximo 20 caracteres" })
    .optional(),
  email: z.string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" })
    .optional()
    .or(z.literal("")),
  manager_name: z.string()
    .trim()
    .max(200, { message: "Nome do gerente deve ter no máximo 200 caracteres" })
    .optional(),
  manager_phone: z.string()
    .trim()
    .max(20, { message: "Telefone do gerente deve ter no máximo 20 caracteres" })
    .optional(),
  category: z.string()
    .trim()
    .max(50, { message: "Categoria deve ter no máximo 50 caracteres" })
    .optional(),
  size: z.string()
    .trim()
    .max(50, { message: "Tamanho deve ter no máximo 50 caracteres" })
    .optional(),
  priority: z.string()
    .trim()
    .max(50, { message: "Prioridade deve ter no máximo 50 caracteres" })
    .optional(),
  visit_frequency: z.string()
    .trim()
    .max(50, { message: "Frequência de visita deve ter no máximo 50 caracteres" })
    .optional(),
  status: z.enum(["active", "inactive", "pending"]).default("active"),
  latitude: z.number()
    .min(-90, { message: "Latitude deve estar entre -90 e 90" })
    .max(90, { message: "Latitude deve estar entre -90 e 90" })
    .optional(),
  longitude: z.number()
    .min(-180, { message: "Longitude deve estar entre -180 e 180" })
    .max(180, { message: "Longitude deve estar entre -180 e 180" })
    .optional(),
  monthly_revenue: z.number()
    .nonnegative({ message: "Receita mensal deve ser positiva" })
    .optional(),
  notes: z.string()
    .trim()
    .max(2000, { message: "Observações devem ter no máximo 2000 caracteres" })
    .optional(),
});

export type StoreFormData = z.infer<typeof storeSchema>;
