import { describe, expect, it } from "vitest";
import {
  calcularResumo,
  chaveMes,
  intervaloMes,
  isLancamentoAtrasado,
  mesAnterior,
  mesSeguinte,
  serieMensal,
  totaisPorCategoria,
} from "@/lib/quadra/resumoFinanceiro";
import type { QuadraLancamento } from "@/types/quadra";

let seq = 0;
function lanc(partial: Partial<QuadraLancamento>): QuadraLancamento {
  seq += 1;
  return {
    id: `l-${seq}`,
    tipo: "receita",
    categoria: "aluguel_horario",
    descricao: "Teste",
    valor: 100,
    data_competencia: "2026-10-10",
    data_vencimento: "2026-10-10",
    data_pagamento: null,
    status: "pendente",
    forma_pagamento: null,
    reserva_id: null,
    mensalista_id: null,
    competencia_mensalidade: null,
    observacoes: null,
    created_by: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    ...partial,
  };
}

const HOJE = new Date(2026, 9, 25); // 25/10/2026 (mês zero-based)

describe("calcularResumo", () => {
  it("separa recebido, pendente, pago e calcula saldos", () => {
    const r = calcularResumo(
      [
        lanc({ tipo: "receita", valor: 300, status: "pago", data_pagamento: "2026-10-05" }),
        lanc({ tipo: "receita", valor: 200, status: "pendente", data_vencimento: "2026-10-30" }),
        lanc({ tipo: "despesa", valor: 120, status: "pago", data_pagamento: "2026-10-02" }),
        lanc({ tipo: "despesa", valor: 80, status: "pendente", data_vencimento: "2026-10-28" }),
        lanc({ tipo: "despesa", valor: 999, status: "cancelado" }),
      ],
      HOJE,
    );
    expect(r.receitasRecebidas).toBe(300);
    expect(r.receitasPendentes).toBe(200);
    expect(r.despesasPagas).toBe(120);
    expect(r.despesasPendentes).toBe(80);
    expect(r.saldoRealizado).toBe(180);
    expect(r.saldoPrevisto).toBe(300);
    expect(r.qtdReceitasAtrasadas).toBe(0);
    expect(r.qtdDespesasAtrasadas).toBe(0);
  });

  it("contabiliza atrasados apenas para pendentes vencidos antes de hoje", () => {
    const r = calcularResumo(
      [
        lanc({ tipo: "receita", valor: 50, status: "pendente", data_vencimento: "2026-10-20" }),
        lanc({ tipo: "receita", valor: 70, status: "pendente", data_vencimento: "2026-10-25" }),
        lanc({ tipo: "despesa", valor: 30, status: "pendente", data_vencimento: "2026-09-01" }),
        lanc({ tipo: "despesa", valor: 40, status: "pago", data_pagamento: "2026-10-01", data_vencimento: "2026-09-01" }),
      ],
      HOJE,
    );
    expect(r.receitasAtrasadas).toBe(50);
    expect(r.qtdReceitasAtrasadas).toBe(1);
    expect(r.despesasAtrasadas).toBe(30);
    expect(r.qtdDespesasAtrasadas).toBe(1);
  });

  it("aceita valores vindos como string do backend", () => {
    const r = calcularResumo([lanc({ valor: "150.50" as unknown as number, status: "pago", data_pagamento: "2026-10-01" })], HOJE);
    expect(r.receitasRecebidas).toBeCloseTo(150.5);
  });
});

describe("isLancamentoAtrasado", () => {
  it("usa data local (sem shift de fuso) ao comparar vencimento com hoje", () => {
    const vencidoOntem = lanc({ status: "pendente", data_vencimento: "2026-10-24" });
    const venceHoje = lanc({ status: "pendente", data_vencimento: "2026-10-25" });
    expect(isLancamentoAtrasado(vencidoOntem, HOJE)).toBe(true);
    expect(isLancamentoAtrasado(venceHoje, HOJE)).toBe(false);
  });

  it("nunca considera pago ou cancelado como atrasado", () => {
    expect(isLancamentoAtrasado(lanc({ status: "pago", data_pagamento: "2026-01-01", data_vencimento: "2020-01-01" }), HOJE)).toBe(false);
    expect(isLancamentoAtrasado(lanc({ status: "cancelado", data_vencimento: "2020-01-01" }), HOJE)).toBe(false);
  });
});

describe("serieMensal", () => {
  it("gera a quantidade de meses pedida, em ordem cronológica, com saldo", () => {
    const serie = serieMensal(
      [
        lanc({ tipo: "receita", valor: 100, data_competencia: "2026-08-15" }),
        lanc({ tipo: "despesa", valor: 40, data_competencia: "2026-08-20" }),
        lanc({ tipo: "receita", valor: 500, data_competencia: "2026-10-01" }),
        lanc({ tipo: "receita", valor: 999, data_competencia: "2026-11-01" }), // fora da janela
        lanc({ tipo: "despesa", valor: 999, data_competencia: "2026-10-02", status: "cancelado" }),
      ],
      "2026-10",
      3,
    );
    expect(serie.map((p) => p.mes)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(serie[0]).toMatchObject({ receitas: 100, despesas: 40, saldo: 60 });
    expect(serie[1]).toMatchObject({ receitas: 0, despesas: 0, saldo: 0 });
    expect(serie[2]).toMatchObject({ receitas: 500, despesas: 0, saldo: 500 });
  });

  it("atravessa a virada de ano sem pular meses", () => {
    const serie = serieMensal([], "2026-02", 4);
    expect(serie.map((p) => p.mes)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("totaisPorCategoria", () => {
  it("agrupa por categoria do tipo informado, ordenando do maior para o menor", () => {
    const totais = totaisPorCategoria(
      [
        lanc({ tipo: "despesa", categoria: "energia", valor: 200 }),
        lanc({ tipo: "despesa", categoria: "agua", valor: 50 }),
        lanc({ tipo: "despesa", categoria: "energia", valor: 100 }),
        lanc({ tipo: "despesa", categoria: "limpeza", valor: 999, status: "cancelado" }),
        lanc({ tipo: "receita", categoria: "mensalidade", valor: 999 }),
      ],
      "despesa",
    );
    expect(totais).toEqual([
      { categoria: "energia", total: 300 },
      { categoria: "agua", total: 50 },
    ]);
  });
});

describe("utilitários de mês", () => {
  it("calcula intervalo, mês anterior e seguinte", () => {
    expect(intervaloMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(intervaloMes("2028-02")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesSeguinte("2026-12")).toBe("2027-01");
    expect(chaveMes("2026-10-31")).toBe("2026-10");
  });
});
