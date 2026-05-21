// Shared helper to extract SLA / deadline from briefing payload.
// Used by the Notion export edge function.

export type SlaStatus = "no_prazo" | "em_risco" | "vencido" | "sem_sla";

export interface BriefingSla {
  prazo: string | null; // ISO date YYYY-MM-DD
  statusSla: SlaStatus;
  diasRestantes: number | null;
}

const SLA_FIELD_CANDIDATES = [
  "prazo_entrega",
  "data_entrega",
  "deadline",
  "data_evento",
  "data_lancamento",
  "prazo",
  "data_limite",
];

/** Parse YYYY-MM-DD or ISO timestamp without UTC shift in São Paulo. */
function parseIsoDate(raw: string): Date | null {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

function todayInSaoPaulo(): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.format(new Date()); // YYYY-MM-DD
  return parseIsoDate(parts)!;
}

function findPrazoInPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  for (const key of SLA_FIELD_CANDIDATES) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) {
      const parsed = parseIsoDate(v.trim());
      if (parsed) return v.slice(0, 10);
    }
  }
  // shallow scan into nested string values
  for (const key of Object.keys(obj)) {
    if (SLA_FIELD_CANDIDATES.includes(key)) continue;
    const v = obj[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = findPrazoInPayload(v);
      if (nested) return nested;
    }
  }
  return null;
}

export function resolveBriefingSla(payload: unknown): BriefingSla {
  const prazo = findPrazoInPayload(payload);
  if (!prazo) {
    return { prazo: null, statusSla: "sem_sla", diasRestantes: null };
  }
  const prazoDate = parseIsoDate(prazo);
  if (!prazoDate) {
    return { prazo: null, statusSla: "sem_sla", diasRestantes: null };
  }
  const today = todayInSaoPaulo();
  const diffMs = prazoDate.getTime() - today.getTime();
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
  let statusSla: SlaStatus;
  if (dias < 0) statusSla = "vencido";
  else if (dias <= 3) statusSla = "em_risco";
  else statusSla = "no_prazo";
  return { prazo, statusSla, diasRestantes: dias };
}

export const SLA_STATUS_LABEL: Record<SlaStatus, string> = {
  no_prazo: "No prazo",
  em_risco: "Em risco",
  vencido: "Vencido",
  sem_sla: "Sem SLA",
};
