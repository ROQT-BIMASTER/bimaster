// Monta as linhas do catálogo iPaper — lógica compartilhada entre o feed por URL
// (ipaper-feed) e o push de arquivo via Backend API (ipaper-push).
// Fontes: ipaper_produtos (linhas do catálogo; ipaper_id = Id_Pro do Result) e
// erp_estoque_live (saldo disponível + preço do força de vendas, por filial).

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

  // Join DETERMINÍSTICO por código ERP: a coluna ID da planilha do catálogo
  // é o Id_Pro do Result (confirmado em 09/07 — ex.: 57=HB10751, 85=HB320,
  // 10118=HBE2404). Nada de casar por código de fábrica (que se repete entre
  // unidade e caixa master) — cada linha do catálogo aponta o produto exato.
  interface Agregado { saldo: number; preco: number | null }
  const porProduto = new Map<number, Agregado>();
  for (const e of estoque) {
    const g = porProduto.get(e.cod_produto) ?? { saldo: 0, preco: null };
    g.saldo += e.estoque_disponivel ?? 0; // soma as filiais habilitadas
    if (g.preco == null && e.preco_venda != null && e.preco_venda > 0) g.preco = e.preco_venda;
    porProduto.set(e.cod_produto, g);
  }

  return produtos
    .map((p) => {
      const g = porProduto.get(p.ipaper_id);
      // Preço: do ERP (produto exato), exceto itens com preco_fixo (curadoria
      // do catálogo, ex.: caixas com preço próprio no flipbook).
      const price = !p.preco_fixo && g?.preco != null ? g.preco : p.preco;
      return {
        ID: p.ipaper_id,
        NAME: p.nome,
        STOCK: g === undefined ? 0 : Math.max(0, Math.floor(g.saldo)),
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
