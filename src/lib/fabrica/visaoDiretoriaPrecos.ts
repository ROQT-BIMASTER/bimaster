/**
 * Visão de preços para aprovação da diretoria.
 *
 * Monta, a partir do comparativo do simulador, uma estrutura única consumida
 * pelas exportações (Excel e PDF): regra de formação de cada tabela escrita
 * por extenso, preços por produto, multiplicador sobre o custo de fábrica,
 * resumo por tabela e pontos de atenção.
 */
import type { TipoMarkup } from "@/lib/fabrica/cascataPricing";
import {
  markupDaTabela,
  markupEfetivo,
  type PerfilItemCalc,
  type TabelaNode,
} from "@/lib/fabrica/perfilSimulacao";

export const BASE_CUSTO_FABRICA = "Custo fábrica";
export const SEM_LINHA = "Sem linha";

export interface ProdutoPrecificado {
  produto: string;
  linha?: string | null;
  custo: number;
  /** id da tabela -> preço */
  precos: Record<string, number>;
}

export interface ColunaDiretoria {
  id: string;
  /** Nome completo da tabela (ex.: "Tabela Clear"). */
  nome: string;
  /** Nome sem o prefixo "Tabela" (ex.: "Clear"). */
  rotulo: string;
  /** Rótulo da base sobre a qual a regra é aplicada. */
  base: string;
  tipo: TipoMarkup;
  valor: number;
  /** Regra por extenso (ex.: "+42% s/ Clear"). */
  regra: string;
  /** Média de preço / custo de fábrica. */
  multiplicadorMedio: number;
  /** Média de (preço - custo) / preço, em %. */
  margemMedia: number;
  menorPreco: number;
  maiorPreco: number;
}

export interface LinhaDiretoria {
  produto: string;
  linha: string;
  custo: number;
  precos: Record<string, number>;
  /** id da tabela -> preço / custo de fábrica */
  multiplicadores: Record<string, number>;
}

export interface GrupoDiretoria {
  linha: string;
  itens: LinhaDiretoria[];
}

export interface VisaoDiretoria {
  perfil: string;
  colunas: ColunaDiretoria[];
  /** Um grupo por linha comercial; sem agrupamento, um único grupo. */
  grupos: GrupoDiretoria[];
  totalProdutos: number;
  /** Há ao menos um produto com linha comercial informada. */
  usaLinha: boolean;
  agrupado: boolean;
  pontosAtencao: string[];
}

const fmtNumero = (v: number, maxDec = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: maxDec }).format(v);

const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(v);

/** Remove o prefixo "Tabela" do nome para uso em regras e rótulos curtos. */
export function nomeCurtoTabela(nome: string): string {
  const curto = nome.replace(/^\s*tabela\s+(de\s+)?/i, "").trim();
  return curto || nome.trim();
}

/** Descreve a regra de formação de preço em linguagem de negócio. */
export function descreverRegra(tipo: TipoMarkup, valor: number, base: string): string {
  const sobre = `s/ ${base}`;
  switch (tipo) {
    case "percentual":
      return `${valor >= 0 ? "+" : ""}${fmtNumero(valor)}% ${sobre}`;
    case "multiplicador":
      return `×${fmtNumero(valor, 4)} ${sobre}`;
    case "valor_fixo":
      return `${valor >= 0 ? "+" : "-"}${fmtMoeda(Math.abs(valor))} ${sobre}`;
    case "margem_pct":
      return `Margem ${fmtNumero(valor)}% ${sobre}`;
    case "desconto_pct":
      return `-${fmtNumero(valor)}% ${sobre}`;
  }
}

export interface RegraTabela {
  tipo: TipoMarkup;
  valor: number;
  /** Rótulo da base (tabela anterior ou custo de fábrica). */
  base: string;
  regra: string;
}

/** Regra efetiva da tabela no perfil, com a base resolvida pelo nome. */
export function regraDaTabela(
  tabela: TabelaNode,
  tabelas: TabelaNode[],
  itensPerfil: PerfilItemCalc[],
): RegraTabela {
  const { tipo, valor } = markupDaTabela(tabela, itensPerfil);
  const baseTabela = tabela.tabela_base_id
    ? tabelas.find((t) => t.id === tabela.tabela_base_id)
    : undefined;
  const base = baseTabela ? nomeCurtoTabela(baseTabela.nome) : BASE_CUSTO_FABRICA;
  return { tipo, valor, base, regra: descreverRegra(tipo, valor, base) };
}

const media = (valores: number[]) =>
  valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;

interface MontarVisaoParams {
  perfil: string;
  itensPerfil: PerfilItemCalc[];
  /** Todas as tabelas da cadeia (resolve a base de cada regra). */
  tabelas: TabelaNode[];
  /** Tabelas exibidas, na ordem desejada. */
  colunas: TabelaNode[];
  produtos: ProdutoPrecificado[];
  agruparPorLinha: boolean;
}

export function montarVisaoDiretoria({
  perfil,
  itensPerfil,
  tabelas,
  colunas,
  produtos,
  agruparPorLinha,
}: MontarVisaoParams): VisaoDiretoria {
  const linhas: LinhaDiretoria[] = produtos.map((p) => {
    const multiplicadores: Record<string, number> = {};
    for (const c of colunas) multiplicadores[c.id] = markupEfetivo(p.precos[c.id] ?? 0, p.custo);
    return {
      produto: p.produto.trim() || "Sem descrição",
      linha: (p.linha || "").trim() || SEM_LINHA,
      custo: p.custo,
      precos: p.precos,
      multiplicadores,
    };
  });

  const colunasDiretoria: ColunaDiretoria[] = colunas.map((t) => {
    const comPreco = linhas.filter((l) => (l.precos[t.id] ?? 0) > 0 && l.custo > 0);
    const precos = comPreco.map((l) => l.precos[t.id]);
    return {
      id: t.id,
      nome: t.nome,
      rotulo: nomeCurtoTabela(t.nome),
      ...regraDaTabela(t, tabelas, itensPerfil),
      multiplicadorMedio: media(comPreco.map((l) => l.multiplicadores[t.id])),
      margemMedia: media(comPreco.map((l) => ((l.precos[t.id] - l.custo) / l.precos[t.id]) * 100)),
      menorPreco: precos.length ? Math.min(...precos) : 0,
      maiorPreco: precos.length ? Math.max(...precos) : 0,
    };
  });

  const usaLinha = linhas.some((l) => l.linha !== SEM_LINHA);
  const agrupado = agruparPorLinha && usaLinha;

  let grupos: GrupoDiretoria[];
  if (agrupado) {
    const mapa = new Map<string, LinhaDiretoria[]>();
    for (const l of linhas) mapa.set(l.linha, [...(mapa.get(l.linha) ?? []), l]);
    grupos = Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([linha, itens]) => ({ linha, itens }));
  } else {
    grupos = [{ linha: "", itens: linhas }];
  }

  return {
    perfil,
    colunas: colunasDiretoria,
    grupos,
    totalProdutos: linhas.length,
    usaLinha,
    agrupado,
    pontosAtencao: pontosDeAtencao(linhas, colunasDiretoria),
  };
}

function pontosDeAtencao(linhas: LinhaDiretoria[], colunas: ColunaDiretoria[]): string[] {
  const pontos: string[] = [];

  const contagem = new Map<string, { nome: string; n: number }>();
  for (const l of linhas) {
    const chave = `${l.produto.toLowerCase()}|${l.linha.toLowerCase()}`;
    const atual = contagem.get(chave);
    contagem.set(chave, { nome: atual?.nome ?? l.produto, n: (atual?.n ?? 0) + 1 });
  }
  for (const { nome, n } of contagem.values()) {
    if (n > 1) pontos.push(`${nome} aparece ${n} vezes na simulação.`);
  }

  const semCusto = linhas.filter((l) => !(l.custo > 0)).map((l) => l.produto);
  if (semCusto.length) {
    pontos.push(`Sem custo de fábrica válido: ${semCusto.join(", ")}.`);
  }

  for (const c of colunas) {
    const abaixo = linhas.filter((l) => l.custo > 0 && (l.precos[c.id] ?? 0) > 0 && l.precos[c.id] <= l.custo);
    if (abaixo.length) {
      pontos.push(
        `${c.nome}: preço igual ou abaixo do custo de fábrica em ${abaixo.map((l) => l.produto).join(", ")}.`,
      );
    }
  }

  return pontos;
}
