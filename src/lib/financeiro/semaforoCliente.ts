// Semáforo de posição financeira do cliente (contas a receber).
// Regras (definidas no prompt de produto):
//   verde   = vencido = 0                                     -> "Em dia"
//   amarelo = vencido > 0 e maior_atraso_dias <= 60           -> "Atraso curto"
//   vermelho = maior_atraso_dias > 60                         -> "Inadimplente"
// Extra:
//   legado = maior_atraso_dias > 365 (dívida antiga; sinaliza sem alarmar).

export interface PosicaoFinanceiraCliente {
  cliente_futura_id: number;
  cliente_nome: string | null;
  em_aberto: number;
  vencido: number;
  a_vencer: number;
  n_parcelas_abertas: number;
  n_parcelas_vencidas: number;
  n_pedidos_abertos: number;
  n_titulos_abertos: number;
  proximo_vencimento: string | null;
  maior_atraso_dias: number;
  sincronizado_em: string | null;
}

export type SemaforoTone = "verde" | "amarelo" | "vermelho";

export interface SemaforoResult {
  tone: SemaforoTone;
  label: string;
  legado: boolean;
  dotClass: string;
  textClass: string;
  borderClass: string;
  bgSoftClass: string;
}

export function computeSemaforo(input: {
  vencido: number | null | undefined;
  maior_atraso_dias: number | null | undefined;
}): SemaforoResult {
  const vencido = Number(input.vencido ?? 0);
  const atraso = Number(input.maior_atraso_dias ?? 0);

  let tone: SemaforoTone = "verde";
  let label = "Em dia";
  if (atraso > 60) {
    tone = "vermelho";
    label = "Inadimplente";
  } else if (vencido > 0) {
    tone = "amarelo";
    label = "Atraso curto";
  }

  const legado = atraso > 365;

  return {
    tone,
    label,
    legado,
    dotClass:
      tone === "verde" ? "bg-emerald-500"
      : tone === "amarelo" ? "bg-amber-500"
      : "bg-red-500",
    textClass:
      tone === "verde" ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amarelo" ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400",
    borderClass:
      tone === "verde" ? "border-emerald-500/40"
      : tone === "amarelo" ? "border-amber-500/40"
      : "border-red-500/40",
    bgSoftClass:
      tone === "verde" ? "bg-emerald-500/5"
      : tone === "amarelo" ? "bg-amber-500/5"
      : "bg-red-500/5",
  };
}
