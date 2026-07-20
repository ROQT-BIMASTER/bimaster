import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SerieMensalPonto {
  mes: string;          // YYYY-MM-DD (primeiro dia do mês)
  faturamento: number;
  notas: number;
}

export type SerieMensalSource = "futura" | "rubysp";

const sb = supabase as any;

/** Normaliza "YYYY-MM" | "YYYY-MM-DD" para "YYYY-MM-01". */
function normalizeMes(raw: unknown): string {
  const s = String(raw ?? "");
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(0, 7)}-01`;
  // fallback: tenta Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }
  return s;
}

export function useVendasSerieMensalCliente(
  clienteId: number | null | undefined,
  source: SerieMensalSource = "futura",
) {
  return useQuery({
    queryKey: ["vendas_serie_mensal_cliente", source, clienteId],
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SerieMensalPonto[]> => {
      if (source === "rubysp") {
        const { data, error } = await sb.rpc("serie_mensal_cliente_rubysp", {
          p_cliente_id: clienteId,
        });
        if (error) throw error;
        return ((data ?? []) as any[]).map((r) => ({
          mes: normalizeMes(r.ano_mes ?? r.mes),
          faturamento: Number(r.faturamento ?? 0),
          notas: Number(r.n_pedidos ?? r.notas ?? 0),
        }));
      }

      const desde = new Date();
      desde.setMonth(desde.getMonth() - 24);
      desde.setDate(1);
      const p_desde = desde.toISOString().slice(0, 10);

      const { data, error } = await sb.rpc("vendas_serie_mensal_cliente", {
        p_cliente_futura_id: clienteId,
        p_desde,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        mes: normalizeMes(r.mes),
        faturamento: Number(r.faturamento ?? 0),
        notas: Number(r.notas ?? 0),
      }));
    },
  });
}
