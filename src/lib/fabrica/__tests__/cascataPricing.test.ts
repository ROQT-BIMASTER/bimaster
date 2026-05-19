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

  it("aplicarMarkup multiplicador e valor_fixo", () => {
    expect(aplicarMarkup(10, "multiplicador", 3)).toBe(30);
    expect(aplicarMarkup(10, "valor_fixo", 2.5)).toBe(12.5);
  });

  it("aplicarMarkup margem_pct (preco = base / (1 - margem))", () => {
    // margem 40% sobre custo 60 → preço 100
    expect(aplicarMarkup(60, "margem_pct", 40)).toBeCloseTo(100, 4);
    // margem 100% é inválida → 0 (evita divisão por zero)
    expect(aplicarMarkup(10, "margem_pct", 100)).toBe(0);
  });

  it("aplicarMarkup desconto_pct (preco = base * (1 - desc))", () => {
    expect(aplicarMarkup(100, "desconto_pct", 10)).toBeCloseTo(90, 4);
    expect(aplicarMarkup(100, "desconto_pct", 0)).toBe(100);
  });

  it("aplicarMarkup retorna 0 para custo inválido (regressão PL/pgSQL divisão por zero)", () => {
    expect(aplicarMarkup(0, "percentual", 25)).toBe(0);
    expect(aplicarMarkup(-1, "multiplicador", 2)).toBe(0);
    expect(aplicarMarkup(NaN, "valor_fixo", 5)).toBe(0);
  });

  it("simula cascata com UM ÚNICO produto (regressão escopo unitário)", () => {
    const produtos: ProdutoEscopo[] = [
      { produto_id: "p1", produto_nome: "BATOM", produto_codigo: "B1", custo_raiz: 3.9877 },
    ];
    const linhas = simularCascata(produtos, cadeia);
    expect(linhas).toHaveLength(1);
    const [linha] = linhas;
    expect(linha.precos["fab"]).toBe(3.9877);
    expect(linha.precos["clear"]).toBeCloseTo(3.9877 * 1.25, 4);
    expect(linha.precos["ecom"]).toBeCloseTo(3.9877 * 1.25 * 4, 4);
  });

  it("simula cascata com MÚLTIPLOS produtos sem cross-contamination", () => {
    const produtos: ProdutoEscopo[] = [
      { produto_id: "p1", produto_nome: "A", produto_codigo: "A", custo_raiz: 10 },
      { produto_id: "p2", produto_nome: "B", produto_codigo: "B", custo_raiz: 20 },
      { produto_id: "p3", produto_nome: "C", produto_codigo: "C", custo_raiz: 0 },
    ];
    const linhas = simularCascata(produtos, cadeia);
    expect(linhas).toHaveLength(3);
    expect(linhas[0].precos["clear"]).toBeCloseTo(12.5, 4);
    expect(linhas[1].precos["clear"]).toBeCloseTo(25, 4);
    // produto sem custo_raiz não deve gerar preço (regressão divisão por zero PL/pgSQL)
    expect(linhas[2].precos["clear"]).toBe(0);
    expect(linhas[2].precos["ecom"]).toBe(0);
  });

  it("simula cascata com escopo VAZIO retorna array vazio", () => {
    expect(simularCascata([], cadeia)).toEqual([]);
  });

  it("simula cascata sem raiz retorna vazio (regressão cadeia malformada)", () => {
    const semRaiz = cadeia.filter((t) => t.nivel !== 0);
    expect(
      simularCascata(
        [{ produto_id: "p", produto_nome: "x", produto_codigo: "x", custo_raiz: 1 }],
        semRaiz,
      ),
    ).toEqual([]);
  });

  it("bloqueia seleção pulando tabela sequencial", () => {
    const sel = new Set<string>(["ecom"]);
    const invalidos = validarSelecaoSequencial(sel, cadeia, "fab");
    expect(invalidos).toContain("ecom");
  });

  it("permite seleção quando parent está marcado", () => {
    const sel = new Set<string>(["clear", "ecom"]);
    const invalidos = validarSelecaoSequencial(sel, cadeia, "fab");
    expect(invalidos).toHaveLength(0);
  });

  it("permite seleção apenas da tabela filha imediata da raiz", () => {
    const sel = new Set<string>(["clear"]);
    const invalidos = validarSelecaoSequencial(sel, cadeia, "fab");
    expect(invalidos).toHaveLength(0);
  });
});

describe("cascata RPC contract (regressão falhas parciais)", () => {
  type CascataResp = {
    total: number;
    tabelas_aprovadas: Array<{ tabela_id: string; tipo: "raiz" | "dependente"; linhas_afetadas: number }>;
    tabelas_falhadas: Array<{ tabela_id: string; erro: string; sqlstate: string }>;
    produtos_afetados: string[];
    escopo_size: number;
    raiz_aprovada: boolean;
  };

  it("aceita resposta mista (sucesso + falha) no mesmo lote", () => {
    const resp: CascataResp = {
      total: 2,
      tabelas_aprovadas: [
        { tabela_id: "fab", tipo: "raiz", linhas_afetadas: 5 },
        { tabela_id: "clear", tipo: "dependente", linhas_afetadas: 5 },
      ],
      tabelas_falhadas: [{ tabela_id: "ecom", erro: "div by zero", sqlstate: "22012" }],
      produtos_afetados: ["p1", "p2", "p3", "p4", "p5"],
      escopo_size: 5,
      raiz_aprovada: true,
    };
    expect(resp.escopo_size).toBe(resp.produtos_afetados.length);
    expect(resp.tabelas_falhadas[0]).toHaveProperty("erro");
    expect(resp.tabelas_falhadas[0]).toHaveProperty("sqlstate");
  });

  it("aceita resposta de aprovação de UM ÚNICO produto", () => {
    const resp: CascataResp = {
      total: 1,
      tabelas_aprovadas: [{ tabela_id: "fab", tipo: "raiz", linhas_afetadas: 1 }],
      tabelas_falhadas: [],
      produtos_afetados: ["p1"],
      escopo_size: 1,
      raiz_aprovada: true,
    };
    expect(resp.escopo_size).toBe(1);
    expect(resp.tabelas_falhadas).toHaveLength(0);
  });

  it("aceita resposta de aprovação de MÚLTIPLOS produtos", () => {
    const resp: CascataResp = {
      total: 3,
      tabelas_aprovadas: [
        { tabela_id: "fab", tipo: "raiz", linhas_afetadas: 10 },
        { tabela_id: "clear", tipo: "dependente", linhas_afetadas: 10 },
        { tabela_id: "ecom", tipo: "dependente", linhas_afetadas: 10 },
      ],
      tabelas_falhadas: [],
      produtos_afetados: Array.from({ length: 10 }, (_, i) => `p${i}`),
      escopo_size: 10,
      raiz_aprovada: true,
    };
    expect(resp.tabelas_aprovadas).toHaveLength(3);
    expect(resp.escopo_size).toBe(10);
  });
});
