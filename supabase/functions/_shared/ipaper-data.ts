// Monta as linhas do catálogo iPaper — lógica compartilhada entre o feed por URL
// (ipaper-feed) e o push de arquivo via Backend API (ipaper-push).
// Fontes: ipaper_produtos (de-para ID iPaper ↔ CODHB + preço/embalagem) e
// erp_estoque_live (saldo disponível + preço do força de vendas do Result).

// deno-lint-ignore-file no-explicit-any

async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}

export interface IpaperLinha {
  ID: number;
  NAME: string;
  STOCK: number;
  DESCRIPTION: string;
  CODHB: string;
  PRICE: number | null;
  "PACKAGE SIZE": number | null;
}

export async function buildIpaperRows(supabase: any): Promise<IpaperLinha[]> {
  const [produtos, estoque] = await Promise.all([
    fetchAll<{ ipaper_id: number; nome: string; codhb: string | null; preco: number | null; preco_fixo: boolean; package_size: number | null }>(
      (from, to) => supabase
        .from("ipaper_produtos")
        .select("ipaper_id, nome, codhb, preco, preco_fixo, package_size")
        .eq("ativo", true)
        .order("ipaper_id")
        .range(from, to),
    ),
    fetchAll<{ cod_produto: number; cod_fabricante: string | null; estoque_disponivel: number | null; preco_venda: number | null }>(
      (from, to) => supabase
        .from("erp_estoque_live")
        .select("cod_produto, cod_fabricante, estoque_disponivel, preco_venda")
        .order("cod_produto")
        .range(from, to),
    ),
  ]);

  // O mesmo código de fábrica pode existir em MAIS DE UM produto do Result
  // (unidade × caixa master). Agrupamos por código → candidatos (um por
  // cod_produto, saldo somado nas filiais) e escolhemos o candidato cujo preço
  // fica mais perto do preço de referência do catálogo (seed) — senão o feed
  // pega a granularidade errada (ex.: HBA7005 R$3,46 virava R$1.992,96 da caixa).
  interface Candidato { saldo: number; preco: number | null }
  const porCodigo = new Map<string, Map<number, Candidato>>();
  for (const e of estoque) {
    const cod = (e.cod_fabricante ?? "").trim().toUpperCase();
    if (!cod) continue;
    let m = porCodigo.get(cod);
    if (!m) { m = new Map(); porCodigo.set(cod, m); }
    const c = m.get(e.cod_produto) ?? { saldo: 0, preco: null };
    c.saldo += e.estoque_disponivel ?? 0;
    if (c.preco == null && e.preco_venda != null && e.preco_venda > 0) c.preco = e.preco_venda;
    m.set(e.cod_produto, c);
  }

  return produtos
    .map((p) => {
      const cod = (p.codhb ?? "").trim().toUpperCase();
      const cands = cod ? Array.from(porCodigo.get(cod)?.values() ?? []) : [];
      let winner: Candidato | undefined;
      if (cands.length === 1) {
        winner = cands[0];
      } else if (cands.length > 1) {
        winner = p.preco != null
          ? cands.reduce((a, b) =>
              Math.abs((a.preco ?? Infinity) - p.preco!) <= Math.abs((b.preco ?? Infinity) - p.preco!) ? a : b)
          : cands.reduce((a, b) => (a.saldo >= b.saldo ? a : b));
      }
      // Preço do ERP só entra se estiver numa faixa sã do preço de referência
      // (0,5×–2×): acompanha reajuste real, rejeita troca de granularidade.
      let price = p.preco;
      if (!p.preco_fixo && winner?.preco != null) {
        const dentroDaFaixa = p.preco == null ||
          (winner.preco >= p.preco * 0.5 && winner.preco <= p.preco * 2);
        if (dentroDaFaixa) price = winner.preco;
      }
      return {
        ID: p.ipaper_id,
        NAME: p.nome,
        STOCK: winner === undefined ? 0 : Math.max(0, Math.floor(winner.saldo)),
        DESCRIPTION: "",
        CODHB: p.codhb ?? "",
        PRICE: price,
        "PACKAGE SIZE": p.package_size,
      };
    })
    // Regra do catálogo: item zerado NÃO vai no arquivo (mesma prática das
    // planilhas manuais "SEM ITENS ZERADOS") — o iPaper só recebe estoque ≥ 1.
    .filter((l) => l.STOCK >= 1);
}
