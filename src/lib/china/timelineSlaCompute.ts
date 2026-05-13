/**
 * Cálculo puro de prazos (SLA) por etapa da linha do tempo China-Brasil.
 *
 * Recebe a configuração (dias por etapa) e a base (created_at da submissão)
 * e devolve, para cada etapa, a data limite acumulada e o status SLA.
 *
 * Sem dependência de DOM, sem fetch — fácil de testar.
 */

export interface SlaConfig {
  stage_1_dias: number;
  stage_2_dias: number;
  stage_3_dias: number;
  stage_4_dias: number;
  stage_5_dias: number;
  stage_6_dias: number;
  stage_7_dias: number;
  stage_8_dias: number;
  stage_9_dias: number;
  stage_10_dias: number;
}

export const EMPTY_SLA: SlaConfig = {
  stage_1_dias: 0,
  stage_2_dias: 0,
  stage_3_dias: 0,
  stage_4_dias: 0,
  stage_5_dias: 0,
  stage_6_dias: 0,
  stage_7_dias: 0,
  stage_8_dias: 0,
  stage_9_dias: 0,
  stage_10_dias: 0,
};

export type SlaStatus =
  | "no_sla"      // não há prazo configurado
  | "no_prazo"   // tem prazo, ainda dentro
  | "perto"      // ≤ 3 dias para vencer
  | "atrasado"   // venceu sem conclusão
  | "concluida_no_prazo"
  | "concluida_atrasada";

export interface StageDeadline {
  stage: number;
  diasEtapa: number;       // duração SLA desta etapa, em dias (0 = sem SLA)
  dueAt: Date | null;      // data limite acumulada (null se sem SLA configurado)
  daysRemaining: number | null;
  status: SlaStatus;
  /** Quando concluída, dias de adiantamento (positivo) ou atraso (negativo). */
  diffDias: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function diffInDays(a: Date, b: Date): number {
  // Diferença em dias inteiros, ignorando hora.
  const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((ad - bd) / DAY_MS);
}

export interface ComputeInput {
  base: Date | null;
  sla: SlaConfig;
  /** Para cada etapa (1–10), data real de conclusão (se houver) e flag "done". */
  stageState: Array<{ stage: number; done: boolean; concluidaEm: Date | null }>;
  /** "Hoje" para testes; default = new Date(). */
  now?: Date;
}

export function computeStageDeadlines(input: ComputeInput): StageDeadline[] {
  const { base, sla, stageState } = input;
  const now = input.now ?? new Date();
  if (!base) {
    return stageState.map((s) => ({
      stage: s.stage,
      diasEtapa: getDias(sla, s.stage),
      dueAt: null,
      daysRemaining: null,
      status: "no_sla",
      diffDias: null,
    }));
  }

  let cumulativo = 0;
  return stageState.map((s) => {
    const dias = getDias(sla, s.stage);
    cumulativo += dias;
    if (dias === 0 && cumulativo === 0) {
      return {
        stage: s.stage,
        diasEtapa: 0,
        dueAt: null,
        daysRemaining: null,
        status: "no_sla",
        diffDias: null,
      };
    }
    const dueAt = addDays(base, cumulativo);

    if (s.done && s.concluidaEm) {
      const diff = diffInDays(dueAt, s.concluidaEm);
      return {
        stage: s.stage,
        diasEtapa: dias,
        dueAt,
        daysRemaining: null,
        status: diff >= 0 ? "concluida_no_prazo" : "concluida_atrasada",
        diffDias: diff,
      };
    }

    const remaining = diffInDays(dueAt, now);
    let status: SlaStatus;
    if (remaining < 0) status = "atrasado";
    else if (remaining <= 3) status = "perto";
    else status = "no_prazo";

    return {
      stage: s.stage,
      diasEtapa: dias,
      dueAt,
      daysRemaining: remaining,
      status,
      diffDias: null,
    };
  });
}

function getDias(sla: SlaConfig, stage: number): number {
  switch (stage) {
    case 1: return sla.stage_1_dias;
    case 2: return sla.stage_2_dias;
    case 3: return sla.stage_3_dias;
    case 4: return sla.stage_4_dias;
    case 5: return sla.stage_5_dias;
    case 6: return sla.stage_6_dias;
    case 7: return sla.stage_7_dias;
    case 8: return sla.stage_8_dias;
    case 9: return sla.stage_9_dias;
    case 10: return sla.stage_10_dias;
    default: return 0;
  }
}

export function totalSlaDias(sla: SlaConfig): number {
  return (
    sla.stage_1_dias + sla.stage_2_dias + sla.stage_3_dias +
    sla.stage_4_dias + sla.stage_5_dias + sla.stage_6_dias +
    sla.stage_7_dias + sla.stage_8_dias + sla.stage_9_dias +
    sla.stage_10_dias
  );
}

export const STAGE_LABELS: Record<number, string> = {
  1: "Submissão criada",
  2: "Documentos & parecer",
  3: "Enviada ao Brasil",
  4: "Aprovação Brasil",
  5: "Pedido (OC)",
  6: "Produção",
  7: "Embarque",
  8: "Trânsito",
  9: "Desembaraço",
  10: "Recebido no CD",
};
