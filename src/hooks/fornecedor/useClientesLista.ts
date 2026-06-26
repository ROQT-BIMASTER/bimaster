import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface ClienteListaRow {
  cliente_futura_id: number;
  cliente_nome: string | null;
  cliente_cnpj_cpf: string | null;
  total_compras: number;
  total_quantidade: number;
  total_valor: number;
  ticket_medio: number;
  ultima_compra: string | null;
  primeira_compra: string | null;
}

/**
 * Agrega `v_vendas` em uma lista de clientes (cliente_futura_id distinto).
 * Faz a agregação no front; v_vendas já vem filtrada por RLS no backend.
 * Para volumes grandes, considerar criar uma view dedicada.
 */
export function useClientesLista() {
  const query = useQuery({
    queryKey: ["fornecedor-clientes-lista"],
    queryFn: async (): Promise<ClienteListaRow[]> => {
      const PAGE = 1000;
      let from = 0;
      const acc = new Map<number, ClienteListaRow>();
      // paginação defensiva para evitar limite default de 1000
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await sb
          .from("v_vendas")
          .select(
            "cliente_futura_id, cliente_nome, cliente_cnpj_cpf, quantidade, total_nota, data_emissao",
          )
          .order("data_emissao", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("[useClientesLista] v_vendas error", error);
          throw error;
        }
        if (!data || data.length === 0) break;
        for (const row of data) {
          const id = Number(row.cliente_futura_id);
          if (!id) continue;
          const ex = acc.get(id);
          const valor = Number(row.total_nota ?? 0);
          const qtd = Number(row.quantidade ?? 0);
          const dt = row.data_emissao ?? null;
          if (!ex) {
            acc.set(id, {
              cliente_futura_id: id,
              cliente_nome: row.cliente_nome ?? null,
              cliente_cnpj_cpf: row.cliente_cnpj_cpf ?? null,
              total_compras: 1,
              total_quantidade: qtd,
              total_valor: valor,
              ticket_medio: valor,
              ultima_compra: dt,
              primeira_compra: dt,
            });
          } else {
            ex.total_compras += 1;
            ex.total_quantidade += qtd;
            ex.total_valor += valor;
            ex.ticket_medio = ex.total_valor / ex.total_compras;
            if (dt && (!ex.ultima_compra || dt > ex.ultima_compra)) ex.ultima_compra = dt;
            if (dt && (!ex.primeira_compra || dt < ex.primeira_compra)) ex.primeira_compra = dt;
            if (!ex.cliente_nome && row.cliente_nome) ex.cliente_nome = row.cliente_nome;
            if (!ex.cliente_cnpj_cpf && row.cliente_cnpj_cpf) ex.cliente_cnpj_cpf = row.cliente_cnpj_cpf;
          }
        }
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 50_000) break; // safety
      }
      return Array.from(acc.values()).sort((a, b) => b.total_valor - a.total_valor);
    },
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useClientesFiltrados(rows: ClienteListaRow[] | undefined, search: string) {
  return useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.cliente_nome ?? "").toLowerCase().includes(q) ||
      (r.cliente_cnpj_cpf ?? "").toLowerCase().includes(q) ||
      String(r.cliente_futura_id).includes(q),
    );
  }, [rows, search]);
}
