import { z } from "zod";

export const atividadeSchema = z.object({
  prospect_id: z
    .string()
    .uuid({ message: "Prospect inválido" })
    .min(1, { message: "Selecione um prospect" }),
  tipo: z.enum(["ligacao", "email", "reuniao", "visita", "proposta"], {
    errorMap: () => ({ message: "Tipo de atividade inválido" })
  }),
  descricao: z
    .string()
    .trim()
    .min(10, { message: "Descrição deve ter no mínimo 10 caracteres" })
    .max(1000, { message: "Descrição deve ter no máximo 1000 caracteres" }),
  resultado: z.enum(["positivo", "neutro", "negativo"], {
    errorMap: () => ({ message: "Resultado inválido" })
  }).optional().or(z.literal("")),
  data_atividade: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" })
    .refine((date) => {
      const activityDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return activityDate <= today;
    }, { message: "Data da atividade não pode ser futura" }),
  proximo_followup: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" })
    .refine((date) => {
      if (!date) return true;
      const followupDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return followupDate >= today;
    }, { message: "Data de follow-up não pode ser passada" })
    .optional()
    .or(z.literal("")),
});

export type AtividadeFormData = z.infer<typeof atividadeSchema>;
