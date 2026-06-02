import { z } from "zod";

export const MOTIVOS_OFFBOARDING = [
  { value: "desligamento", label: "Desligamento da empresa" },
  { value: "mudou_squad", label: "Mudou de squad / área" },
  { value: "fim_contrato", label: "Fim de contrato" },
  { value: "outro", label: "Outro" },
] as const;

export type MotivoOffboarding = (typeof MOTIVOS_OFFBOARDING)[number]["value"];

export const offboardingPayloadSchema = z
  .object({
    membroId: z.string().uuid(),
    motivo: z.enum(["desligamento", "mudou_squad", "fim_contrato", "outro"]),
    motivoDetalhe: z.string().max(500).optional().nullable(),
    novoResponsavelTarefas: z.string().uuid().nullable(),
    novoSeguidor: z.string().uuid().nullable(),
  })
  .strict();

export type OffboardingPayload = z.infer<typeof offboardingPayloadSchema>;
