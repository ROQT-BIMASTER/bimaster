import { z } from "zod";

export const criarPeriodoSchema = z
  .object({
    nome: z.string().trim().min(1, "Nome obrigatório").max(120),
    tipo: z.enum(["mensal", "trimestral", "semestral", "anual"]),
    data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    valor_total_empresa: z.number().nonnegative("Valor inválido"),
  })
  .strict()
  .refine((d) => d.data_fim >= d.data_inicio, {
    message: "Data final deve ser maior ou igual à inicial",
    path: ["data_fim"],
  });

export type CriarPeriodoInput = z.infer<typeof criarPeriodoSchema>;

export const distribuirVerbaSchema = z
  .object({
    period_id: z.string().uuid(),
    alocacoes: z
      .array(
        z
          .object({
            department_id: z.string().uuid(),
            valor: z.number().nonnegative(),
          })
          .strict(),
      )
      .min(1, "Inclua ao menos um departamento"),
  })
  .strict();

export type DistribuirVerbaInput = z.infer<typeof distribuirVerbaSchema>;

export const planoCategoriaSchema = z
  .object({
    id: z.string().uuid().optional(),
    distribution_id: z.string().uuid(),
    categoria_id: z.string().uuid(),
    nome: z.string().trim().max(120).optional().nullable(),
    valor_planejado: z.number().nonnegative(),
    cor: z.string().trim().max(32).optional().nullable(),
    is_reserva: z.boolean().default(false),
    ordem: z.number().int().nonnegative().default(0),
  })
  .strict();

export type PlanoCategoriaInput = z.infer<typeof planoCategoriaSchema>;

export const atribuirPerfilSchema = z
  .object({
    department_id: z.string().uuid(),
    user_id: z.string().uuid(),
    perfil: z.enum(["solicitante", "executor", "gestor", "financeiro"]),
  })
  .strict();

export type AtribuirPerfilInput = z.infer<typeof atribuirPerfilSchema>;
