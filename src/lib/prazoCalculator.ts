import { calcularDataUtil, contarDiasUteis } from "@/hooks/useFeriados";

export type RegimeCalendario = "corridos" | "dias_uteis" | "uteis_com_sabado";

/** Converte string YYYY-MM-DD ou Date em Date local sem efeito de timezone (meia-noite local). */
export function parseDateLocal(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Formata Date para YYYY-MM-DD em horário local. */
export function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normaliza lista de feriados (objetos com `data: YYYY-MM-DD`) num Set. */
export function feriadosToSet(feriados: { data: string }[] | null | undefined): Set<string> {
  const s = new Set<string>();
  for (const f of feriados ?? []) s.add(f.data.slice(0, 10));
  return s;
}

export interface CalcularPrazoArgs {
  inicio: Date | string;
  dias: number;
  regime?: RegimeCalendario;
  feriadosSet?: Set<string>;
}

/** Soma `dias` ao `inicio` respeitando o regime e feriados. Retorna a data final. */
export function calcularPrazoComFeriados({
  inicio,
  dias,
  regime = "dias_uteis",
  feriadosSet = new Set(),
}: CalcularPrazoArgs): Date {
  const base = parseDateLocal(inicio) ?? new Date();
  return calcularDataUtil(base, dias, regime, feriadosSet);
}

/** Conta dias úteis entre duas datas. */
export function contarDiasUteisEntre(
  inicio: Date | string,
  fim: Date | string,
  regime: RegimeCalendario = "dias_uteis",
  feriadosSet: Set<string> = new Set(),
): number {
  const a = parseDateLocal(inicio);
  const b = parseDateLocal(fim);
  if (!a || !b) return 0;
  return contarDiasUteis(a, b, regime, feriadosSet);
}

export interface ValidarHierarquiaArgs {
  /** Prazo do registro filho (ex.: subtarefa). */
  filhoPrazo: string | Date | null | undefined;
  /** Prazo do registro pai (ex.: tarefa). */
  paiPrazo: string | Date | null | undefined;
  /** Rótulo do filho usado na mensagem (ex.: "subtarefa"). */
  filhoLabel: string;
  /** Rótulo do pai usado na mensagem (ex.: "tarefa pai"). */
  paiLabel: string;
}

export interface ValidacaoResultado {
  ok: boolean;
  motivo?: string;
}

/** Valida se o prazo do filho não ultrapassa o prazo do pai. */
export function validarHierarquiaPrazo({
  filhoPrazo,
  paiPrazo,
  filhoLabel,
  paiLabel,
}: ValidarHierarquiaArgs): ValidacaoResultado {
  const f = parseDateLocal(filhoPrazo ?? null);
  const p = parseDateLocal(paiPrazo ?? null);
  if (!f || !p) return { ok: true };
  if (f.getTime() > p.getTime()) {
    return {
      ok: false,
      motivo: `O prazo da ${filhoLabel} (${formatBR(f)}) não pode ultrapassar o prazo da ${paiLabel} (${formatBR(p)}).`,
    };
  }
  return { ok: true };
}

function formatBR(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
