import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Dataset determinístico: mesmo produto-raiz aparece em 2 filiais (empresas 1 e 2)
// + um produto exclusivo da empresa 1, garantindo que a consolidação reduza o nº de linhas.
const RAW_ROWS = [
  {
    empresa: 1, produto_raiz: 100,
    saldo_em_caixas: 10, saldo_em_displays: 4, saldo_em_unidades: 20,
    saldo_total_em_unidades: 200, bloqueado_total_em_unidades: 10,
    disponivel_total_em_unidades: 190, pendente_total_em_unidades: 5,
    custo_total: 1000, skus_envolvidos: 3,
    fator_cx_para_un: 10, fator_bx_para_un: 5, ean_raiz: '789',
  },
  {
    empresa: 2, produto_raiz: 100,
    saldo_em_caixas: 5, saldo_em_displays: 2, saldo_em_unidades: 8,
    saldo_total_em_unidades: 80, bloqueado_total_em_unidades: 4,
    disponivel_total_em_unidades: 76, pendente_total_em_unidades: 1,
    custo_total: 400, skus_envolvidos: 3,
    fator_cx_para_un: 10, fator_bx_para_un: 5, ean_raiz: '789',
  },
  {
    empresa: 1, produto_raiz: 200,
    saldo_em_caixas: 2, saldo_em_displays: 1, saldo_em_unidades: 3,
    saldo_total_em_unidades: 50, bloqueado_total_em_unidades: 0,
    disponivel_total_em_unidades: 50, pendente_total_em_unidades: 0,
    custo_total: 250, skus_envolvidos: 1,
    fator_cx_para_un: 10, fator_bx_para_un: 5, ean_raiz: '790',
  },
];

const DIM_EMPRESA_ROWS = [
  { id_empresa: 1, nome_empresa: 'Filial São Paulo' },
  { id_empresa: 2, nome_empresa: 'Filial Rio de Janeiro' },
];

// `abrev_par` no ERP é a fonte canônica do nome da filial (ganha sobre dim_empresa).
const ABREV_ROWS = [
  { empresa_par: 1, cod_produto: 100, abrev_par: 'Filial São Paulo' },
  { empresa_par: 2, cod_produto: 100, abrev_par: 'Filial Rio de Janeiro' },
  { empresa_par: 1, cod_produto: 200, abrev_par: 'Filial São Paulo' },
];

vi.mock('@/integrations/supabase/client', () => {
  const fromHandler = (table: string) => {
    if (table === 'vw_estoque_unificado') {
      const builder: any = {
        select: () => builder,
        in: () => builder,
        gt: () => builder,
        order: () => builder,
        range: () => Promise.resolve({ data: RAW_ROWS, error: null }),
      };
      return builder;
    }
    if (table === 'dim_empresa') {
      const builder: any = {
        select: () => builder,
        in: () => Promise.resolve({ data: DIM_EMPRESA_ROWS, error: null }),
      };
      return builder;
    }
    // erp_estoque_distribuidora — devolve ABREV_ROWS para qualquer select.
    // O loop de nomes lê só cod_produto/nome_prod (campos ausentes = ignorados),
    // o loop de abreviações lê abrev_par.
    const enrichBuilder: any = {
      select: () => enrichBuilder,
      in: () => enrichBuilder,
      limit: () => Promise.resolve({ data: ABREV_ROWS, error: null }),
      range: () => Promise.resolve({ data: ABREV_ROWS, error: null }),
    };
    return enrichBuilder;
  };
  return { supabase: { from: fromHandler } };
});

import { useEstoqueUnificado } from '../useEstoqueUnificado';

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseOpts = {
  empresaIds: [1, 2],
  busca: '',
  somenteComSaldo: false,
  page: 0,
  pageSize: 50,
  sortBy: 'saldo_total_em_unidades' as const,
  sortDir: 'desc' as const,
};

describe('useEstoqueUnificado — paridade entre modos consolidado / não consolidado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregateRows e totais de KPI são idênticos com e sem consolidação', async () => {
    const w = wrapper();
    const offHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: false }), { wrapper: w });
    const onHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: true }), { wrapper: w });

    await waitFor(() => expect(offHook.result.current.data).toBeTruthy());
    await waitFor(() => expect(onHook.result.current.data).toBeTruthy());

    const off = offHook.result.current.data!;
    const on = onHook.result.current.data!;

    // aggregateRows: mesmas linhas canônicas (consolidadas por produto_raiz) em ambos os modos
    expect(off.aggregateRows.length).toBe(on.aggregateRows.length);
    expect(off.aggregateRows.length).toBe(2); // produto 100 (consolidado) + produto 200

    const sumField = (rows: any[], k: string) =>
      rows.reduce((s, r) => s + Number(r[k] || 0), 0);

    const fields = [
      'saldo_em_caixas',
      'saldo_em_displays',
      'saldo_em_unidades',
      'saldo_total_em_unidades',
      'bloqueado_total_em_unidades',
      'disponivel_total_em_unidades',
      'pendente_total_em_unidades',
      'custo_total',
    ];
    for (const f of fields) {
      expect(sumField(off.aggregateRows, f)).toBe(sumField(on.aggregateRows, f));
    }

    // Valores esperados (somatório do RAW_ROWS)
    expect(sumField(on.aggregateRows, 'saldo_total_em_unidades')).toBe(330);
    expect(sumField(on.aggregateRows, 'custo_total')).toBe(1650);
    expect(sumField(on.aggregateRows, 'bloqueado_total_em_unidades')).toBe(14);
    expect(sumField(on.aggregateRows, 'disponivel_total_em_unidades')).toBe(316);
  });

  it('contagem de linhas exibidas reflete o modo, mas o universo agregado é o mesmo', async () => {
    const w = wrapper();
    const offHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: false }), { wrapper: w });
    const onHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: true }), { wrapper: w });

    await waitFor(() => expect(offHook.result.current.data).toBeTruthy());
    await waitFor(() => expect(onHook.result.current.data).toBeTruthy());

    const off = offHook.result.current.data!;
    const on = onHook.result.current.data!;

    // Linhas exibidas na tabela: não consolidado mostra 1 linha por (empresa, produto_raiz);
    // consolidado agrupa por produto_raiz. Universo agregado é sempre o consolidado canônico.
    expect(off.rows.length).toBe(3);
    expect(on.rows.length).toBe(2);
    expect(off.rows.length).toBeGreaterThan(on.rows.length);
    expect(off.total).toBe(off.rows.length);
    expect(on.total).toBe(on.rows.length);
    // Diferença bate exatamente com o nº de filiais extras consolidadas
    const extrasPorConsolidacao = on.aggregateRows.reduce(
      (s, r: any) => s + Math.max(0, (r.filiais_count ?? 1) - 1),
      0,
    );
    expect(off.rows.length - on.rows.length).toBe(extrasPorConsolidacao);

    expect(off.aggregateRows.length).toBe(2);
    expect(on.aggregateRows.length).toBe(2);
  });

  it('cada linha consolidada corresponde ao conjunto correto de filiais (chaves e somatórios)', async () => {
    const w = wrapper();
    const offHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: false }), { wrapper: w });
    const onHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: true }), { wrapper: w });

    await waitFor(() => expect(offHook.result.current.data).toBeTruthy());
    await waitFor(() => expect(onHook.result.current.data).toBeTruthy());

    const off = offHook.result.current.data!.rows;
    const on = onHook.result.current.data!.rows;

    // 1) Mesmo universo de produto_raiz dos dois lados
    const offRaizes = new Set(off.map((r) => Number(r.produto_raiz)));
    const onRaizes = new Set(on.map((r) => Number(r.produto_raiz)));
    expect([...onRaizes].sort()).toEqual([...offRaizes].sort());

    // 2) produto_raiz é único no modo consolidado
    expect(on.length).toBe(new Set(on.map((r) => Number(r.produto_raiz))).size);

    // 3) Agrupando o não-consolidado por produto_raiz, o conjunto de empresas
    //    deve coincidir exatamente com `filiais` da linha consolidada correspondente.
    const offByRaiz = new Map<number, typeof off>();
    for (const r of off) {
      const k = Number(r.produto_raiz);
      const arr = offByRaiz.get(k) ?? [];
      arr.push(r);
      offByRaiz.set(k, arr);
    }

    for (const cons of on) {
      const k = Number(cons.produto_raiz);
      const filiaisOff = offByRaiz.get(k) ?? [];
      const empresasOff = new Set(filiaisOff.map((r) => r.empresa));
      const empresasCons = new Set((cons.filiais ?? []).map((f: any) => f.empresa));
      expect([...empresasCons].sort()).toEqual([...empresasOff].sort());
      expect(cons.filiais_count ?? filiaisOff.length).toBe(filiaisOff.length);

      // filiais_rows da linha consolidada espelha 1:1 as linhas não-consolidadas
      const rowsEmpresas = new Set((cons.filiais_rows ?? []).map((r: any) => r.empresa));
      expect([...rowsEmpresas].sort()).toEqual([...empresasOff].sort());

      // Soma das filiais bate com o agregado da linha consolidada
      const sumOff = filiaisOff.reduce((s, r) => s + Number(r.saldo_total_em_unidades || 0), 0);
      expect(Number(cons.saldo_total_em_unidades)).toBe(sumOff);
      const custoOff = filiaisOff.reduce((s, r) => s + Number(r.custo_total || 0), 0);
      expect(Number(cons.custo_total)).toBe(custoOff);
    }
  });

  it('linhas carregam o nome oficial da filial (sem cair para número)', async () => {
    const w = wrapper();
    const offHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: false }), { wrapper: w });
    const onHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: true }), { wrapper: w });

    await waitFor(() => expect(offHook.result.current.data).toBeTruthy());
    await waitFor(() => expect(onHook.result.current.data).toBeTruthy());

    const off = offHook.result.current.data!.rows;
    const on = onHook.result.current.data!.rows;

    const nomeEsperado: Record<number, string> = {
      1: 'Filial São Paulo',
      2: 'Filial Rio de Janeiro',
    };

    for (const r of off) {
      expect(r.filial_nome).toBe(nomeEsperado[r.empresa]);
      expect(r.filial_nome).not.toMatch(/^\d+$/);
    }

    for (const cons of on) {
      for (const f of cons.filiais ?? []) {
        expect(f.filial_nome).toBe(nomeEsperado[f.empresa]);
      }
      for (const fr of cons.filiais_rows ?? []) {
        expect(fr.filial_nome).toBe(nomeEsperado[fr.empresa]);
      }
    }
  });

  it('coluna "Empresa" nunca exibe apenas número (consolidado e não consolidado)', async () => {
    const w = wrapper();
    const offHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: false }), { wrapper: w });
    const onHook = renderHook(() => useEstoqueUnificado({ ...baseOpts, consolidar: true }), { wrapper: w });

    await waitFor(() => expect(offHook.result.current.data).toBeTruthy());
    await waitFor(() => expect(onHook.result.current.data).toBeTruthy());

    const off = offHook.result.current.data!.rows;
    const on = onHook.result.current.data!.rows;

    // Espelha a lógica de render do EstoqueUnificadoTable.tsx
    const labelNaoConsolidado = (r: any) =>
      r.filial_nome ?? r.raiz_abrev ?? `Empresa ${r.empresa}`;
    const labelConsolidadoFiliais = (f: any) =>
      f.filial_nome || f.abrev || `Empresa ${f.empresa}`;
    const labelConsolidadoBadge = (r: any) => {
      const count = r.filiais_count ?? 1;
      const first = (r.filiais ?? [])[0];
      const firstLabel =
        first?.filial_nome ?? first?.abrev ?? r.filial_nome ?? r.raiz_abrev ?? null;
      return count > 1 ? `${count} filiais` : firstLabel ? `${firstLabel} · 1 filial` : '1 filial';
    };

    const isApenasNumero = (s: string | null | undefined) =>
      typeof s === 'string' && /^\d+$/.test(s.trim());

    for (const r of off) {
      const label = labelNaoConsolidado(r);
      expect(label).toBeTruthy();
      expect(isApenasNumero(label)).toBe(false);
      expect(label).not.toMatch(/^Empresa\s+\d+$/);
    }

    for (const cons of on) {
      const badge = labelConsolidadoBadge(cons);
      expect(isApenasNumero(badge)).toBe(false);
      expect(badge).not.toMatch(/^Empresa\s+\d+$/);

      for (const f of cons.filiais ?? []) {
        const l = labelConsolidadoFiliais(f);
        expect(isApenasNumero(l)).toBe(false);
        expect(l).not.toMatch(/^Empresa\s+\d+$/);
      }
      for (const fr of cons.filiais_rows ?? []) {
        const l = fr.filial_nome ?? fr.raiz_abrev ?? `Empresa ${fr.empresa}`;
        expect(isApenasNumero(l)).toBe(false);
        expect(l).not.toMatch(/^Empresa\s+\d+$/);
      }
    }
  });
});
