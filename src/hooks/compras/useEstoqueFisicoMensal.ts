import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EstoqueFisicoRow {
  empresa_result: number;
  data_foto: string;
  produtos: number | null;
  unidades: number | null;
  valor_ultimo_custo: number | null;
  valor_custo_familia: number | null;
}

export interface EstoqueFisicoMensalPoint {
  mes: string; // YYYY-MM-01
  data_foto: string; // última foto do mês
  produtos: number;
  unidades: number;
  valor_ultimo_custo: number;
  valor_custo_familia: number;
  delta_valor_custo_familia: number;
  delta_valor_ultimo_custo: number;
  delta_unidades: number;
  parcial: boolean;
}

export interface UseEstoqueFisicoOpts {
  empresas: number[];
  from: string;
  to: string;
}

/**
 * Retorna a série mensal de estoque físico (última foto de cada mês).
 * Quando `empresas` está vazio, soma o grupo. Caso contrário filtra e
 * também soma as filiais selecionadas.
 */
export function useEstoqueFisicoMensal(opts: UseEstoqueFisicoOpts) {
  return useQuery({
    queryKey: [
      "estoque-fisico-mensal",
      [...opts.empresas].sort(),
      opts.from,
      opts.to,
    ],
    staleTime: 60_000,
    queryFn: async (): Promise<EstoqueFisicoMensalPoint[]> => {
      let q = supabase
        .from("erp_estoque_fisico" as any)
        .select(
          "empresa_result,data_foto,produtos,unidades,valor_ultimo_custo,valor_custo_familia",
        )
        .gte("data_foto", opts.from)
        .lte("data_foto", opts.to)
        .order("data_foto", { ascending: true });
      if (opts.empresas.length) q = q.in("empresa_result", opts.empresas);
      const { data, error } = await q;
      if (error) throw error;

      const rows = ((data as any[]) ?? []).map((r) => ({
        empresa_result: Number(r.empresa_result),
        data_foto: r.data_foto as string,
        produtos: r.produtos == null ? null : Number(r.produtos),
        unidades: r.unidades == null ? null : Number(r.unidades),
        valor_ultimo_custo:
          r.valor_ultimo_custo == null ? null : Number(r.valor_ultimo_custo),
        valor_custo_familia:
          r.valor_custo_familia == null ? null : Number(r.valor_custo_familia),
      })) as EstoqueFisicoRow[];

      // 1) por empresa, guardar a última foto de cada mês
      // key: `${empresa_result}|${YYYY-MM}` -> row
      const lastByEmpresaMes = new Map<string, EstoqueFisicoRow>();
      for (const r of rows) {
        const ym = r.data_foto.slice(0, 7);
        const k = `${r.empresa_result}|${ym}`;
        const cur = lastByEmpresaMes.get(k);
        if (!cur || r.data_foto > cur.data_foto) lastByEmpresaMes.set(k, r);
      }

      // 2) somar por mês
      const byMes = new Map<
        string,
        {
          mes: string;
          data_foto: string;
          produtos: number;
          unidades: number;
          valor_ultimo_custo: number;
          valor_custo_familia: number;
        }
      >();
      for (const r of lastByEmpresaMes.values()) {
        const ym = r.data_foto.slice(0, 7);
        const mes = `${ym}-01`;
        const cur = byMes.get(mes) ?? {
          mes,
          data_foto: r.data_foto,
          produtos: 0,
          unidades: 0,
          valor_ultimo_custo: 0,
          valor_custo_familia: 0,
        };
        cur.produtos += r.produtos ?? 0;
        cur.unidades += r.unidades ?? 0;
        cur.valor_ultimo_custo += r.valor_ultimo_custo ?? 0;
        cur.valor_custo_familia += r.valor_custo_familia ?? 0;
        // guardar a maior data como referência do mês (para exibição)
        if (r.data_foto > cur.data_foto) cur.data_foto = r.data_foto;
        byMes.set(mes, cur);
      }

      const now = new Date();
      const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const sorted = Array.from(byMes.values()).sort((a, b) =>
        a.mes.localeCompare(b.mes),
      );

      const out: EstoqueFisicoMensalPoint[] = [];
      let prev: (typeof sorted)[number] | null = null;
      for (const r of sorted) {
        out.push({
          ...r,
          delta_valor_custo_familia: prev
            ? r.valor_custo_familia - prev.valor_custo_familia
            : 0,
          delta_valor_ultimo_custo: prev
            ? r.valor_ultimo_custo - prev.valor_ultimo_custo
            : 0,
          delta_unidades: prev ? r.unidades - prev.unidades : 0,
          parcial: r.mes.slice(0, 7) === currentYM,
        });
        prev = r;
      }
      return out;
    },
  });
}
