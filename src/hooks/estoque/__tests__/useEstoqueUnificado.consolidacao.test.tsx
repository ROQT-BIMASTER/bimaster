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
    // erp_estoque_distribuidora (enriquecimento de nomes)
    const enrichBuilder: any = {
      select: () => enrichBuilder,
      in: () => enrichBuilder,
      limit: () => Promise.resolve({ data: [], error: null }),
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

    expect(offHook.result.current.data!.total).toBe(3); // por filial
    expect(onHook.result.current.data!.total).toBe(2);  // consolidado
    // aggregateRows é sempre o consolidado canônico
    expect(offHook.result.current.data!.aggregateRows.length).toBe(2);
    expect(onHook.result.current.data!.aggregateRows.length).toBe(2);
  });
});
