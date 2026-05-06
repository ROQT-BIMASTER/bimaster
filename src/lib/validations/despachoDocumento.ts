import { z } from "zod";

export const DestinoTipoEnum = z.enum(["projeto_tarefa", "responsavel", "modulo"]);
export type DestinoTipo = z.infer<typeof DestinoTipoEnum>;

export const PrazoOrigemEnum = z.enum(["tarefa", "tipo_doc", "manual", "default"]);
export const PrioridadeEnum = z.enum(["normal", "alta", "critica"]);

export const DespachoDestinoSchema = z.object({
  tipo: DestinoTipoEnum,
  projeto_id: z.string().uuid().nullable().optional(),
  projeto_nome: z.string().nullable().optional(),
  tarefa_id: z.string().uuid().nullable().optional(),
  tarefa_titulo: z.string().nullable().optional(),
  secao_id: z.string().uuid().nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  responsavel_nome: z.string().nullable().optional(),
  modulo_destino: z.string().nullable().optional(),
}).strict();

export const DespacharDocSchema = z.object({
  submissao_id: z.string().uuid(),
  documento_id: z.string().uuid(),
  destinos: z.array(DespachoDestinoSchema).min(1),
  prazo_sla: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  prazo_origem: PrazoOrigemEnum,
  sla_horas_uteis: z.number().int().nullable().optional(),
  prioridade: PrioridadeEnum.default("normal"),
  observacao: z.string().max(2000).optional(),
}).strict();

export type DespacharDocInput = z.infer<typeof DespacharDocSchema>;
export type DespachoDestino = z.infer<typeof DespachoDestinoSchema>;
