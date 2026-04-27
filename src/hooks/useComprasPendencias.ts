import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OrigemPendencia = "china" | "brasil";

export interface CompraPendencia {
  origem: OrigemPendencia;
  oc_id: string;
  numero: string;
  item_id: string;
  descricao: string;
  produto_nome: string | null;
  qty_pedida: number;
  qty_produzida: number | null;
  qty_embarcada: number | null;
  qty_recebida: number;
  qty_cancelada: number;
  qty_pendente: number;
  data_entrega_prevista: string | null;
  status: string;
  created_at: string;
}

export interface PendenciasFiltros {
  origem?: OrigemPendencia | "todos";
  status?: string;
  apenas_pendentes?: boolean;
  apenas_atrasadas?: boolean;
}

export function useComprasPendencias(filtros: PendenciasFiltros = {}) {
  return useQuery({
    queryKey: ["compras-pendencias", filtros],
    queryFn: async () => {
      let query = supabase
        .from("v_compras_pendencias" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (filtros.origem && filtros.origem !== "todos") {
        query = query.eq("origem", filtros.origem);
      }
      if (filtros.status) {
        query = query.eq("status", filtros.status);
      }
      const { data, error } = await query;
      if (error) throw error;

      let rows = (data || []) as unknown as CompraPendencia[];
      if (filtros.apenas_pendentes) rows = rows.filter((r) => r.qty_pendente > 0);
      if (filtros.apenas_atrasadas) {
        const hoje = new Date().toISOString().slice(0, 10);
        rows = rows.filter(
          (r) => r.qty_pendente > 0 && r.data_entrega_prevista && r.data_entrega_prevista < hoje,
        );
      }
      return rows;
    },
    staleTime: 60 * 1000,
  });
}

export function useComprasKpis() {
  const { data: rows = [], isLoading } = useComprasPendencias({ apenas_pendentes: true });
  const hoje = new Date().toISOString().slice(0, 10);
  const china = rows.filter((r) => r.origem === "china");
  const brasil = rows.filter((r) => r.origem === "brasil");
  const atrasadas = rows.filter(
    (r) => r.data_entrega_prevista && r.data_entrega_prevista < hoje,
  );
  const ocsAbertas = new Set(rows.map((r) => `${r.origem}:${r.oc_id}`)).size;
  const totalPendente = rows.reduce((s, r) => s + Number(r.qty_pendente || 0), 0);

  return {
    isLoading,
    ocsAbertas,
    totalPendente,
    chinaPendente: china.reduce((s, r) => s + Number(r.qty_pendente || 0), 0),
    brasilPendente: brasil.reduce((s, r) => s + Number(r.qty_pendente || 0), 0),
    atrasadas: atrasadas.length,
  };
}
