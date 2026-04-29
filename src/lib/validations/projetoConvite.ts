import { z } from "zod";

export const PAPEIS_CONVITE = [
  "membro",
  "coordenador",
  "gestor_produto",
  "regulatorio",
  "design",
  "controle_arte",
  "admin_cofre",
  "diretoria",
] as const;

export const projetoConviteSchema = z
  .object({
    projeto_id: z.string().uuid({ message: "Projeto inválido" }),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: "E-mail inválido" })
      .max(255),
    papel: z.enum(PAPEIS_CONVITE, { errorMap: () => ({ message: "Papel inválido" }) }),
    secoes_ids: z.array(z.string().uuid()).default([]),
    mensagem: z
      .string()
      .trim()
      .max(500, { message: "Mensagem deve ter no máximo 500 caracteres" })
      .optional()
      .or(z.literal("")),
  })
  .strict();

export type ProjetoConviteInput = z.infer<typeof projetoConviteSchema>;
