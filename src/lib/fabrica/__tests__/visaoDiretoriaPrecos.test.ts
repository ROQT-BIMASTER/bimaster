import { describe, it, expect } from "vitest";
import {
  descreverRegra,
  montarVisaoDiretoria,
  nomeCurtoTabela,
  regraDaTabela,
  type ProdutoPrecificado,
} from "../visaoDiretoriaPrecos";
import { precosPorTabela, type PerfilItemCalc, type TabelaNode } from "../perfilSimulacao";

// Cadeia como vem de useTabelasCadeia: a raiz (custo de fábrica) fica fora da lista.
const tabelas: TabelaNode[] = [
  { id: "clear", nome: "Tabela Clear", tabela_base_id: "fab", tipo_markup: "percentual", valor_markup: 10 },
  { id: "mude", nome: "Tabela Mude", tabela_base_id: "clear", tipo_markup: "percentual", valor_markup: 42 },
  { id: "prim", nome: "Tabela Primavera", tabela_base_id: "mude", tipo_markup: "percentual", valor_markup: 8 },
  { id: "deep", nome: "Tabela Deep", tabela_base_id: "mude", tipo_markup: "multiplicador", valor_markup: 1.7 },
  { id: "ecom", nome: "Tabela E-commerce", tabela_base_id: "clear", tipo_markup: "percentual", valor_markup: 300 },
];

const itensPerfil: PerfilItemCalc[] = [
  { tabela_id: "prim", tipo_markup: "percentual", valor_markup: 30 },
  { tabela_id: "deep", tipo_markup: "percentual", valor_markup: 1.7 },
];

const produto = (nome: string, custo: number, linha?: string): ProdutoPrecificado => ({
  produto: nome,
  linha,
  custo,
  precos: precosPorTabela(custo, tabelas, itensPerfil),
});

describe("visaoDiretoriaPrecos", () => {
  it("nomeCurtoTabela remove o prefixo Tabela", () => {
    expect(nomeCurtoTabela("Tabela Clear")).toBe("Clear");
    expect(nomeCurtoTabela("Tabela de E-commerce")).toBe("E-commerce");
    expect(nomeCurtoTabela("B2B")).toBe("B2B");
    expect(nomeCurtoTabela("Tabela")).toBe("Tabela");
  });

  it("descreverRegra escreve cada tipo de markup por extenso", () => {
    expect(descreverRegra("percentual", 42, "Clear")).toBe("+42% s/ Clear");
    expect(descreverRegra("percentual", 1.7, "Mude")).toBe("+1,7% s/ Mude");
    expect(descreverRegra("multiplicador", 1.7, "Mude")).toBe("×1,7 s/ Mude");
    expect(descreverRegra("margem_pct", 30, "Clear")).toBe("Margem 30% s/ Clear");
    expect(descreverRegra("desconto_pct", 10, "Clear")).toBe("-10% s/ Clear");
    expect(descreverRegra("valor_fixo", 0.5, "Clear").replace(/\s/g, " ")).toBe("+R$ 0,50 s/ Clear");
  });

  it("regraDaTabela usa o override do perfil e resolve a base", () => {
    expect(regraDaTabela(tabelas[0], tabelas, itensPerfil).regra).toBe("+10% s/ Custo fábrica");
    expect(regraDaTabela(tabelas[2], tabelas, itensPerfil).regra).toBe("+30% s/ Mude");
    expect(regraDaTabela(tabelas[3], tabelas, itensPerfil).regra).toBe("+1,7% s/ Mude");
    expect(regraDaTabela(tabelas[3], tabelas, []).regra).toBe("×1,7 s/ Mude");
  });

  it("monta colunas, multiplicadores e resumo por tabela", () => {
    const visao = montarVisaoDiretoria({
      perfil: "Perfil A — Padrão",
      itensPerfil,
      tabelas,
      colunas: tabelas,
      produtos: [produto("RR5151", 0.9528), produto("HBF2200", 1.1222), produto("HBM400", 2.6408)],
      agruparPorLinha: false,
    });

    expect(visao.totalProdutos).toBe(3);
    expect(visao.usaLinha).toBe(false);
    expect(visao.agrupado).toBe(false);
    expect(visao.grupos).toHaveLength(1);

    const rr = visao.grupos[0].itens[0];
    expect(rr.precos.clear).toBeCloseTo(1.048, 3);
    expect(rr.precos.mude).toBeCloseTo(1.4883, 3);
    expect(rr.precos.prim).toBeCloseTo(1.9348, 3);
    expect(rr.precos.deep).toBeCloseTo(1.5135, 3);
    expect(rr.precos.ecom).toBeCloseTo(4.1922, 3);
    expect(rr.multiplicadores.ecom).toBeCloseTo(4.4, 6);

    const clear = visao.colunas.find((c) => c.id === "clear")!;
    expect(clear.rotulo).toBe("Clear");
    expect(clear.base).toBe("Custo fábrica");
    expect(clear.multiplicadorMedio).toBeCloseTo(1.1, 6);
    expect(clear.margemMedia).toBeCloseTo((0.1 / 1.1) * 100, 6);
    expect(clear.menorPreco).toBeCloseTo(0.9528 * 1.1, 6);
    expect(clear.maiorPreco).toBeCloseTo(2.6408 * 1.1, 6);
    expect(visao.pontosAtencao).toEqual([]);
  });

  it("agrupa por linha somente quando há linha informada", () => {
    const produtos = [produto("Pó", 5, "Wander"), produto("Base", 9, "Baunilha"), produto("Blush", 4)];
    const agrupada = montarVisaoDiretoria({
      perfil: "P",
      itensPerfil,
      tabelas,
      colunas: tabelas,
      produtos,
      agruparPorLinha: true,
    });
    expect(agrupada.agrupado).toBe(true);
    expect(agrupada.grupos.map((g) => g.linha)).toEqual(["Baunilha", "Sem linha", "Wander"]);

    const semLinha = montarVisaoDiretoria({
      perfil: "P",
      itensPerfil,
      tabelas,
      colunas: tabelas,
      produtos: [produto("Pó", 5)],
      agruparPorLinha: true,
    });
    expect(semLinha.agrupado).toBe(false);
  });

  it("aponta produtos repetidos, sem custo e preço abaixo do custo", () => {
    const abaixo: ProdutoPrecificado = { produto: "Promo", custo: 10, precos: { clear: 9 } };
    const visao = montarVisaoDiretoria({
      perfil: "P",
      itensPerfil,
      tabelas,
      colunas: [tabelas[0]],
      produtos: [produto("RR5151", 0.9528), produto("rr5151", 0.9528), produto("Novo", 0), abaixo],
      agruparPorLinha: false,
    });
    expect(visao.pontosAtencao).toEqual([
      "RR5151 aparece 2 vezes na simulação.",
      "Sem custo de fábrica válido: Novo.",
      "Tabela Clear: preço igual ou abaixo do custo de fábrica em Promo.",
    ]);
  });
});
