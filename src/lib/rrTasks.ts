/**
 * Constantes do domínio RR-Tasks (PR-D2a).
 *
 * Esqueleto reutilizável pelos PRs D2b/D2c. Ainda não consumido em UI.
 */

// Status do RR-Tasks (6 estados, fiéis ao Notion — valores acentuados).
export const RRTASK_STATUS = [
  "Backlog",
  "A Fazer",
  "Em andamento",
  "Revisão",
  "Finalizado",
  "Aprovado",
] as const;
export type RRTaskStatus = (typeof RRTASK_STATUS)[number];

// Gate de Aprovação de Conteúdo (Mirella).
export const RRTASK_APROVACAO = ["Pendente", "Aprovado", "Devolvido"] as const;
export type RRTaskAprovacao = (typeof RRTASK_APROVACAO)[number];

// Etapa — TODO PR-D2c: completar com os 23 valores reais do RR-Tasks
// lendo o schema ao vivo. Conhecidos da auditoria
// (docs/00-auditoria-schema-real.md): Briefing, Faca, Layout QR,
// Etiqueta Bula, AF Embalagem, "Social — Post" … (faltam os demais).
export const RRTASK_ETAPA_PARCIAL = [
  "Briefing",
  "Faca",
  "Layout QR",
  "Etiqueta Bula",
  "AF Embalagem",
  "Social — Post",
] as const;
export type RRTaskEtapaParcial = (typeof RRTASK_ETAPA_PARCIAL)[number];
