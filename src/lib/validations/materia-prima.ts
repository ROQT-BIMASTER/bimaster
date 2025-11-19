import { z } from "zod";

export const materiaPrimaSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, "Código é obrigatório")
    .max(50, "Código deve ter no máximo 50 caracteres")
    .regex(/^[a-zA-Z0-9-_]+$/, "Código deve conter apenas letras, números, hífens e underscores"),
  
  nome: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .max(200, "Nome deve ter no máximo 200 caracteres"),
  
  categoria_id: z
    .string()
    .uuid("Categoria inválida")
    .optional()
    .nullable(),
  
  unidade_medida_id: z
    .string()
    .uuid("Unidade de medida inválida")
    .refine((val) => val && val.length > 0, "Unidade de medida é obrigatória"),
  
  custo_unitario: z
    .number()
    .positive("Custo unitário deve ser maior que zero")
    .finite("Custo unitário deve ser um número válido")
    .optional()
    .nullable(),
  
  estoque_minimo: z
    .number()
    .nonnegative("Estoque mínimo não pode ser negativo")
    .optional(),
  
  fornecedor_id: z
    .string()
    .uuid("Fornecedor inválido")
    .optional()
    .nullable(),
});

export type MateriaPrimaInput = z.infer<typeof materiaPrimaSchema>;
