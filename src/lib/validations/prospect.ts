import { z } from "zod";

export const prospectSchema = z.object({
  nome_empresa: z
    .string()
    .trim()
    .min(2, { message: "Nome da empresa deve ter no mínimo 2 caracteres" })
    .max(200, { message: "Nome da empresa deve ter no máximo 200 caracteres" }),
  cnpj: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, { 
      message: "CNPJ inválido. Use 00.000.000/0000-00" 
    })
    .optional()
    .or(z.literal("")),
  contato_principal: z
    .string()
    .trim()
    .min(3, { message: "Nome do contato deve ter no mínimo 3 caracteres" })
    .max(100, { message: "Nome do contato deve ter no máximo 100 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, { message: "Nome do contato deve conter apenas letras" })
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" })
    .toLowerCase()
    .optional()
    .or(z.literal("")),
  telefone: z
    .string()
    .trim()
    .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, { 
      message: "Telefone inválido. Use (00) 00000-0000" 
    })
    .optional()
    .or(z.literal("")),
  status: z.enum(["novo", "em_contato", "proposta_enviada", "negociacao", "ganho", "perdido"], {
    errorMap: () => ({ message: "Status inválido" })
  }),
  categoria: z.enum(["A", "B", "C", "D"], {
    errorMap: () => ({ message: "Categoria inválida" })
  }).optional().or(z.literal("")),
  observacoes: z
    .string()
    .trim()
    .max(1000, { message: "Observações devem ter no máximo 1000 caracteres" })
    .optional()
    .or(z.literal("")),
});

export type ProspectFormData = z.infer<typeof prospectSchema>;
