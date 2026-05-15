import { describe, it, expect } from "vitest";
import {
  aplicarMarkup,
  simularCascata,
  validarSelecaoSequencial,
  type ProdutoEscopo,
} from "../cascataPricing";
import type { TabelaCadeiaItem } from "@/hooks/useCadeiaTabelas";

const cadeia: TabelaCadeiaItem[] = [
  { id: "fab", codigo: "01", nome: "Fabrica", status: "approved",
    tabela_base_id: null, tipo_base: "manual",
    tipo_markup: "valor_fixo", valor_markup: 0, ordem: 1, nivel: 0 },
  { id: "clear", codigo: "06", nome: "Clear", status: "approved",
    tabela_base_id: "fab", tipo_base: "tabela_anterior",
    tipo_markup: "percentual", valor_markup: 25, ordem: 1, nivel: 1 },
  { id: "ecom", codigo: "05", nome: "E-commerce", status: "approved",
    tabela_base_id: "clear", tipo_base: "tabela_anterior",
    tipo_markup: "percentual", valor_markup: 300, ordem: 1, nivel: 2 },
];

describe("cascataPricing", () => {
  it("aplicarMarkup percentual", () => {
    expect(aplicarMarkup(100, "percentual", 25)).toBe(125);
  });

  it("simula cascata propagando custo de Fábrica para descendentes", () => {
    const produtos: ProdutoEscopo[] = [
      { produto_id: "p1", produto_nome: "BATOM", produto_codigo: "B1", custo_raiz: 3.9877 },
    ];
    const [linha] = simularCascata(produtos, cadeia);
    expect(linha.precos["fab"]).toBe(3.9877);
    expect(linha.precos["clear"]).toBeCloseTo(3.9877 * 1.25, 4);
    expect(linha.precos["ecom"]).toBeCloseTo(3.9877 * 1.25 * 4, 4);
  });

  it("bloqueia seleção pulando tabela sequencial", () => {
    // Selecionar ecom sem clear (clear é parent de ecom)
    const sel = new Set<string>(["ecom"]);
    const invalidos = validarSelecaoSequencial(sel, cadeia, "fab");
    expect(invalidos).toContain("ecom");
  });

  it("permite seleção quando parent está marcado", () => {
    const sel = new Set<string>(["clear", "ecom"]);
    const invalidos = validarSelecaoSequencial(sel, cadeia, "fab");
    expect(invalidos).toHaveLength(0);
  });
});
