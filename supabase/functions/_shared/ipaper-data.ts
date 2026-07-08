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
    fetchAll<{ cod_fabricante: string | null; estoque_disponivel: number | null; preco_venda: number | null }>(
      (from, to) => supabase
        .from("erp_estoque_live")
        .select("cod_fabricante, estoque_disponivel, preco_venda")
        .order("cod_produto")
        .range(from, to),
    ),
  ]);

  // Saldo disponível e preço por código de fábrica (se o mesmo código aparecer
  // em mais de um produto do Result, soma o saldo — hoje o Live já traz 1 linha/produto)
  const saldoPorCodigo = new Map<string, number>();
  const precoPorCodigo = new Map<string, number>();
  for (const e of estoque) {
    const cod = (e.cod_fabricante ?? "").trim().toUpperCase();
    if (!cod) continue;
    saldoPorCodigo.set(cod, (saldoPorCodigo.get(cod) ?? 0) + (e.estoque_disponivel ?? 0));
    if (e.preco_venda != null && e.preco_venda > 0 && !precoPorCodigo.has(cod)) {
      precoPorCodigo.set(cod, e.preco_venda);
    }
  }

  return produtos.map((p) => {
    const cod = (p.codhb ?? "").trim().toUpperCase();
    const saldo = cod ? saldoPorCodigo.get(cod) : undefined;
    const precoLive = cod && !p.preco_fixo ? precoPorCodigo.get(cod) : undefined;
    return {
      ID: p.ipaper_id,
      NAME: p.nome,
      STOCK: saldo === undefined ? 0 : Math.max(0, Math.floor(saldo)),
      DESCRIPTION: "",
      CODHB: p.codhb ?? "",
      PRICE: precoLive ?? p.preco,
      "PACKAGE SIZE": p.package_size,
    };
  });
}
