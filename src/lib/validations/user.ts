import { z } from "zod";

export const userSchema = z.object({
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
  senha: z
    .string()
    .min(8, { message: "Senha deve ter no mínimo 8 caracteres" })
    .max(100, { message: "Senha deve ter no máximo 100 caracteres" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { 
      message: "Senha deve conter letras maiúsculas, minúsculas e números" 
    }),
  tipo_usuario: z.enum(["admin", "supervisor", "vendedor", "promotor"], {
    errorMap: () => ({ message: "Tipo de usuário inválido" })
  }),
});

export type UserFormData = z.infer<typeof userSchema>;
