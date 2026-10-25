import { addMonths, format, isBefore, startOfDay, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { parseLocalDate } from "@/lib/utils/parseLocalDate";
import type { QuadraLancamento } from "@/types/quadra";

/** Chave de mês no formato YYYY-MM a partir de uma data DATE (YYYY-MM-DD). */
export function chaveMes(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function chaveMesDeDate(d: Date): string {
  return format(d, "yyyy-MM");
}

export function labelMes(chave: string): string {
  const d = parseLocalDate(`${chave}-01`);
  return d ? format(d, "MMM/yy", { locale: ptBR }) : chave;
}

export function labelMesLongo(chave: string): string {
  const d = parseLocalDate(`${chave}-01`);
  if (!d) return chave;
  const txt = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Primeiro e último dia (YYYY-MM-DD) do mês informado como YYYY-MM. */
export function intervaloMes(chave: string): { inicio: string; fim: string } {
  const inicio = parseLocalDate(`${chave}-01`) ?? startOfMonth(new Date());
  const fim = addMonths(inicio, 1);
  fim.setDate(0);
  return { inicio: format(inicio, "yyyy-MM-dd"), fim: format(fim, "yyyy-MM-dd") };
}

export function mesAnterior(chave: string): string {
  const d = parseLocalDate(`${chave}-01`) ?? new Date();
  return chaveMesDeDate(subMonths(d, 1));
}

export function mesSeguinte(chave: string): string {
  const d = parseLocalDate(`${chave}-01`) ?? new Date();
  return chaveMesDeDate(addMonths(d, 1));
}

/** Lançamento pendente com vencimento anterior a hoje. */
export function isLancamentoAtrasado(l: QuadraLancamento, hoje: Date = new Date()): boolean {
  if (l.status !== "pendente") return false;
  const venc = parseLocalDate(l.data_vencimento);
  if (!venc) return false;
  return isBefore(startOfDay(venc), startOfDay(hoje));
}

export interface ResumoFinanceiro {
  receitasRecebidas: number;
  receitasPendentes: number;
  despesasPagas: number;
  despesasPendentes: number;
  /** Receitas recebidas menos despesas pagas. */
  saldoRealizado: number;
  /** Tudo que não foi cancelado: receitas menos despesas. */
  saldoPrevisto: number;
  receitasAtrasadas: number;
  despesasAtrasadas: number;
  qtdReceitasAtrasadas: number;
  qtdDespesasAtrasadas: number;
}

/** Soma os lançamentos informados (já filtrados por período). Cancelados são ignorados. */
export function calcularResumo(lancamentos: QuadraLancamento[], hoje: Date = new Date()): ResumoFinanceiro {
  const r: ResumoFinanceiro = {
    receitasRecebidas: 0,
    receitasPendentes: 0,
    despesasPagas: 0,
    despesasPendentes: 0,
    saldoRealizado: 0,
    saldoPrevisto: 0,
    receitasAtrasadas: 0,
    despesasAtrasadas: 0,
    qtdReceitasAtrasadas: 0,
    qtdDespesasAtrasadas: 0,
  };

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    const valor = Number(l.valor) || 0;
    const atrasado = isLancamentoAtrasado(l, hoje);

    if (l.tipo === "receita") {
      if (l.status === "pago") r.receitasRecebidas += valor;
      else r.receitasPendentes += valor;
      if (atrasado) {
        r.receitasAtrasadas += valor;
        r.qtdReceitasAtrasadas += 1;
      }
    } else {
      if (l.status === "pago") r.despesasPagas += valor;
      else r.despesasPendentes += valor;
      if (atrasado) {
        r.despesasAtrasadas += valor;
        r.qtdDespesasAtrasadas += 1;
      }
    }
  }

  r.saldoRealizado = r.receitasRecebidas - r.despesasPagas;
  r.saldoPrevisto =
    r.receitasRecebidas + r.receitasPendentes - (r.despesasPagas + r.despesasPendentes);
  return r;
}

export interface PontoMensal {
  mes: string;
  label: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

/**
 * Série mensal (competência) dos últimos `qtdMeses` meses terminando em `mesFinal` (YYYY-MM).
 * Considera lançamentos não cancelados, pagos ou pendentes.
 */
export function serieMensal(
  lancamentos: QuadraLancamento[],
  mesFinal: string,
  qtdMeses = 6,
): PontoMensal[] {
  const fim = parseLocalDate(`${mesFinal}-01`) ?? startOfMonth(new Date());
  const pontos: PontoMensal[] = [];
  for (let i = qtdMeses - 1; i >= 0; i--) {
    const chave = chaveMesDeDate(subMonths(fim, i));
    pontos.push({ mes: chave, label: labelMes(chave), receitas: 0, despesas: 0, saldo: 0 });
  }
  const idx = new Map(pontos.map((p, i) => [p.mes, i]));

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    const i = idx.get(chaveMes(l.data_competencia));
    if (i === undefined) continue;
    const valor = Number(l.valor) || 0;
    if (l.tipo === "receita") pontos[i].receitas += valor;
    else pontos[i].despesas += valor;
  }
  for (const p of pontos) p.saldo = p.receitas - p.despesas;
  return pontos;
}

export interface TotalCategoria {
  categoria: string;
  total: number;
}

export function totaisPorCategoria(
  lancamentos: QuadraLancamento[],
  tipo: "receita" | "despesa",
): TotalCategoria[] {
  const mapa = new Map<string, number>();
  for (const l of lancamentos) {
    if (l.status === "cancelado" || l.tipo !== tipo) continue;
    mapa.set(l.categoria, (mapa.get(l.categoria) ?? 0) + (Number(l.valor) || 0));
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}
