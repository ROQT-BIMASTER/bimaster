import { z } from "zod";

/**
 * Valida dígitos verificadores do CPF
 */
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;

  // Rejeita CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cleaned[9])) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(cleaned[10])) return false;

  return true;
}

export const teamMemberFormSchema = z.object({
  equipe_comercial: z
    .string()
    .trim()
    .min(1, "Equipe comercial é obrigatória")
    .max(100, "Máximo 100 caracteres"),
  supervisor_nome: z
    .string()
    .trim()
    .min(1, "Supervisor é obrigatório")
    .max(100, "Máximo 100 caracteres"),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(150, "Máximo 150 caracteres"),
  data_nascimento: z
    .string()
    .min(1, "Data de nascimento é obrigatória")
    .refine(
      (val) => {
        const date = new Date(val);
        if (isNaN(date.getTime())) return false;
        const today = new Date();
        const age = today.getFullYear() - date.getFullYear();
        const monthDiff = today.getMonth() - date.getMonth();
        const dayDiff = today.getDate() - date.getDate();
        const exactAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return exactAge >= 16;
      },
      { message: "A pessoa deve ter pelo menos 16 anos" }
    ),
  cpf: z
    .string()
    .min(1, "CPF é obrigatório")
    .refine(
      (val) => {
        const cleaned = val.replace(/\D/g, "");
        return cleaned.length === 11;
      },
      { message: "CPF deve ter 11 dígitos" }
    )
    .refine(
      (val) => isValidCPF(val),
      { message: "CPF inválido" }
    ),
  rg: z
    .string()
    .trim()
    .min(5, "RG deve ter pelo menos 5 caracteres")
    .max(15, "RG deve ter no máximo 15 caracteres")
    .optional()
    .or(z.literal("")),
  email_pessoal: z
    .string()
    .trim()
    .email("E-mail inválido")
    .max(255, "Máximo 255 caracteres")
    .optional()
    .or(z.literal("")),
  whatsapp: z
    .string()
    .min(1, "WhatsApp é obrigatório")
    .refine(
      (val) => {
        const cleaned = val.replace(/\D/g, "");
        return cleaned.length === 10 || cleaned.length === 11;
      },
      { message: "Formato inválido. Use (00) 00000-0000" }
    ),
  tamanho_camiseta: z.enum(["P", "M", "G", "GG", "XGG"], {
    required_error: "Selecione o tamanho da camiseta",
  }),
  observacoes: z.string().trim().max(500, "Máximo 500 caracteres").optional().or(z.literal("")),
});

export type TeamMemberFormData = z.infer<typeof teamMemberFormSchema>;
