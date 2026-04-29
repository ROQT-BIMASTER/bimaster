/**
 * Filtros e tipos compartilhados da Visão de Estoque.
 */

export type CurvaABC = 'A' | 'B' | 'C' | 'D' | 'E';
export type FaixaSaldo = 'sem_estoque' | 'baixo' | 'medio' | 'alto' | 'negativo';

export interface EstoqueFiltros {
  busca: string;
  empresa_ids: number[];
  linhas: string[];
  unidades: string[];
  curvas_fisicas: CurvaABC[];
  curvas_monetarias: CurvaABC[];
  faixas_saldo: FaixaSaldo[];
  apenas_com_saldo: boolean;
  com_pedido_pendente: boolean;
  saldo_min: number | null;
  saldo_max: number | null;
  valor_min: number | null;
  valor_max: number | null;
  ultima_compra_dias: number | null; // 30, 60, 90, 180
  sem_compra: boolean;               // sem compra há +180d
}

export const FILTROS_INICIAIS: EstoqueFiltros = {
  busca: '',
  empresa_ids: [],
  linhas: [],
  unidades: [],
  curvas_fisicas: [],
  curvas_monetarias: [],
  faixas_saldo: [],
  apenas_com_saldo: false,
  com_pedido_pendente: false,
  saldo_min: null,
  saldo_max: null,
  valor_min: null,
  valor_max: null,
  ultima_compra_dias: null,
  sem_compra: false,
};

export function filtrosParaJsonb(f: EstoqueFiltros) {
  return {
    busca: f.busca || undefined,
    empresa_ids: f.empresa_ids.length ? f.empresa_ids : undefined,
    linhas: f.linhas.length ? f.linhas : undefined,
    unidades: f.unidades.length ? f.unidades : undefined,
    curvas_fisicas: f.curvas_fisicas.length ? f.curvas_fisicas : undefined,
    curvas_monetarias: f.curvas_monetarias.length ? f.curvas_monetarias : undefined,
    apenas_com_saldo: f.apenas_com_saldo || undefined,
    com_pedido_pendente: f.com_pedido_pendente || undefined,
    saldo_min: f.saldo_min ?? undefined,
    saldo_max: f.saldo_max ?? undefined,
    valor_min: f.valor_min ?? undefined,
    valor_max: f.valor_max ?? undefined,
    ultima_compra_dias: f.ultima_compra_dias ?? undefined,
    sem_compra: f.sem_compra || undefined,
  };
}

export const FAIXA_LABELS: Record<FaixaSaldo, string> = {
  sem_estoque: 'Sem estoque',
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  negativo: 'Negativo',
};

export const FAIXA_BADGE: Record<FaixaSaldo, string> = {
  sem_estoque: 'bg-muted text-muted-foreground',
  baixo: 'bg-destructive/15 text-destructive',
  medio: 'bg-warning/15 text-warning',
  alto: 'bg-success/15 text-success',
  negativo: 'bg-destructive text-destructive-foreground',
};

/**
 * Classifica saldo em faixa baseada em quartis de empresa+linha.
 * Sem dados de quartil → fallback fixo (10/100).
 */
export function classificarFaixa(
  saldo: number,
  q1?: number | null,
  q3?: number | null,
): FaixaSaldo {
  if (saldo < 0) return 'negativo';
  if (saldo === 0) return 'sem_estoque';
  if (q1 != null && q3 != null) {
    if (saldo <= q1) return 'baixo';
    if (saldo >= q3) return 'alto';
    return 'medio';
  }
  if (saldo < 10) return 'baixo';
  if (saldo > 100) return 'alto';
  return 'medio';
}

export function diasDesde(data: string | null | undefined): number | null {
  if (!data) return null;
  const d = new Date(data);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
