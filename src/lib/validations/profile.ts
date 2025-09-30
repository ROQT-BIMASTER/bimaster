import { z } from "zod";

export const profileSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, { message: "Nome deve ter no mínimo 3 caracteres" })
    .max(100, { message: "Nome deve ter no máximo 100 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, { message: "Nome deve conter apenas letras" }),
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter no máximo 255 caracteres" })
    .toLowerCase(),
  telefone: z
    .string()
    .trim()
    .regex(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/, { message: "Telefone inválido. Use (00) 00000-0000" })
    .optional()
    .or(z.literal("")),
  cargo: z
    .string()
    .trim()
    .max(100, { message: "Cargo deve ter no máximo 100 caracteres" })
    .optional()
    .or(z.literal("")),
  departamento: z
    .string()
    .trim()
    .max(100, { message: "Departamento deve ter no máximo 100 caracteres" })
    .optional()
    .or(z.literal("")),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
