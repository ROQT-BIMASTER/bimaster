import { z } from "zod";

const dataISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" });

const horaHHMM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: "Horário inválido (HH:MM)" });

const valorMonetario = z
  .number({ required_error: "Valor é obrigatório", invalid_type_error: "Valor deve ser um número" })
  .min(0, { message: "Valor não pode ser negativo" })
  .max(1_000_000, { message: "Valor acima do limite permitido" });

const formaPagamento = z.enum([
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
]);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Máximo de ${max} caracteres` })
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const horarioFimMaiorQueInicio = (d: { horario_inicio: string; horario_fim: string }) =>
  d.horario_fim > d.horario_inicio;

export const lancamentoSchema = z
  .object({
    tipo: z.enum(["receita", "despesa"], { required_error: "Tipo é obrigatório" }),
    categoria: z.string().trim().min(2, { message: "Categoria é obrigatória" }).max(60),
    descricao: z
      .string()
      .trim()
      .min(2, { message: "Descrição deve ter ao menos 2 caracteres" })
      .max(200, { message: "Descrição deve ter no máximo 200 caracteres" }),
    valor: valorMonetario.gt(0, { message: "Valor deve ser maior que zero" }),
    data_competencia: dataISO,
    data_vencimento: dataISO,
    data_pagamento: dataISO.optional().or(z.literal("")).transform((v) => (v ? v : null)),
    status: z.enum(["pendente", "pago", "cancelado"]),
    forma_pagamento: formaPagamento.optional().or(z.literal("")).transform((v) => (v ? v : null)),
    observacoes: textoOpcional(500),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (d.status === "pago" && !d.data_pagamento) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data_pagamento"],
        message: "Informe a data do pagamento",
      });
    }
  });

export type LancamentoInput = z.input<typeof lancamentoSchema>;
export type LancamentoOutput = z.output<typeof lancamentoSchema>;

export const reservaSchema = z
  .object({
    data: dataISO,
    horario_inicio: horaHHMM,
    horario_fim: horaHHMM,
    cliente_nome: z
      .string()
      .trim()
      .min(2, { message: "Nome do cliente deve ter ao menos 2 caracteres" })
      .max(120, { message: "Nome deve ter no máximo 120 caracteres" }),
    cliente_telefone: textoOpcional(30),
    mensalista_id: z.string().uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    valor: valorMonetario,
    status: z.enum(["confirmada", "realizada", "cancelada"]),
    status_pagamento: z.enum(["pendente", "pago"]),
    forma_pagamento: formaPagamento.optional().or(z.literal("")).transform((v) => (v ? v : null)),
    observacoes: textoOpcional(500),
  })
  .strict()
  .refine(horarioFimMaiorQueInicio, {
    path: ["horario_fim"],
    message: "Horário final deve ser maior que o inicial",
  });

export type ReservaInput = z.input<typeof reservaSchema>;
export type ReservaOutput = z.output<typeof reservaSchema>;

export const mensalistaSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, { message: "Nome deve ter ao menos 2 caracteres" })
      .max(120, { message: "Nome deve ter no máximo 120 caracteres" }),
    telefone: textoOpcional(30),
    email: z
      .string()
      .trim()
      .email({ message: "E-mail inválido" })
      .max(120)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    dia_semana: z.number().int().min(0).max(6),
    horario_inicio: horaHHMM,
    horario_fim: horaHHMM,
    valor_mensal: valorMonetario,
    dia_vencimento: z
      .number({ invalid_type_error: "Dia inválido" })
      .int()
      .min(1, { message: "Entre 1 e 28" })
      .max(28, { message: "Entre 1 e 28" }),
    ativo: z.boolean(),
    observacoes: textoOpcional(500),
  })
  .strict()
  .refine(horarioFimMaiorQueInicio, {
    path: ["horario_fim"],
    message: "Horário final deve ser maior que o inicial",
  });

export type MensalistaInput = z.input<typeof mensalistaSchema>;
export type MensalistaOutput = z.output<typeof mensalistaSchema>;
