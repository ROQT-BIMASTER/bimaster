import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SuporteChamado, SuporteFila } from "./types";
import type { SuporteViewFiltros, SuporteViewOrdenacao } from "./useSuporteViews";
import { subDays } from "date-fns";

interface Params {
  filaIds: string[];
  filtros: SuporteViewFiltros;
  ordenacao: SuporteViewOrdenacao;
  page: number;
  pageSize: number;
}

async function enriquecerCompleto(rows: any[]): Promise<{ tickets: SuporteChamado[]; nomes: Map<string, string> }> {
  const tickets = (rows ?? []) as SuporteChamado[];
  const nomes = new Map<string, string>();
  if (tickets.length === 0) return { tickets, nomes };

  const filaIds = [...new Set(tickets.map((t) => t.fila_id).filter(Boolean))] as string[];
  const dirIds = [
    ...new Set(
      tickets
        .flatMap((t) => [t.requester_id, t.owner_id, t.assignee_id])
        .filter(Boolean) as string[],
    ),
  ];

  const [filasRes, dirRes] = await Promise.all([
    filaIds.length
      ? supabase.from("suporte_filas" as any).select("id, nome, slug, cor, icone, ordem, ativo, aceita_chamados, descricao").in("id", filaIds)
      : Promise.resolve({ data: [] } as any),
    dirIds.length
      ? supabase.rpc("get_chat_directory" as any).then((r: any) => r)
      : Promise.resolve({ data: [] } as any),
  ]);

  const filaMap = new Map<string, SuporteFila>(
    (((filasRes.data ?? []) as unknown) as SuporteFila[]).map((f) => [f.id, f]),
  );
  const dirMap = new Map<string, { id: string; nome: string | null; avatar_url: string | null }>(
    (((dirRes.data ?? []) as unknown) as { id: string; nome: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
  );
  dirMap.forEach((v, k) => nomes.set(k, v.nome ?? "—"));

  const enriched = tickets.map((t) => ({
    ...t,
    fila: t.fila_id ? filaMap.get(t.fila_id) ?? null : null,
    requester: dirMap.get(t.requester_id ?? t.owner_id) ?? null,
  }));
  return { tickets: enriched, nomes };
}

const ORDER_MAP: Record<string, string> = {
  atualizado_em: "ultima_interacao_em",
  criado_em: "created_at",
  prioridade: "prioridade",
  status: "status",
  protocolo: "protocolo",
  titulo: "titulo",
};

export function useSuporteChamadosPaginated(params: Params) {
  const { user } = useAuth();
  const { filaIds, filtros, ordenacao, page, pageSize } = params;
  const key = ["suporte", "desk-paginated", user?.id, filaIds.sort().join(","), JSON.stringify(filtros), JSON.stringify(ordenacao), page, pageSize];

  return useQuery({
    queryKey: key,
    enabled: !!user?.id && filaIds.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("suporte_tickets" as any)
        .select("*", { count: "exact" })
        .in("fila_id", filaIds);

      // Filtros
      if (filtros.status && filtros.status !== "todos") {
        if (filtros.status === "abertos") {
          q = q.neq("status", "resolvido");
        } else {
          q = q.eq("status", filtros.status);
        }
      }
      if (filtros.categoria && filtros.categoria !== "todas") {
        q = q.eq("categoria", filtros.categoria);
      }
      if (filtros.prioridade && filtros.prioridade !== "todas") {
        q = q.eq("prioridade", filtros.prioridade);
      }
      if (filtros.fila_id) q = q.eq("fila_id", filtros.fila_id);
      if (filtros.assignee_id) q = q.eq("assignee_id", filtros.assignee_id);
      if (filtros.sem_responsavel) q = q.is("assignee_id", null);
      if (filtros.sla_violado) q = q.eq("sla_status", "violado");
      if (filtros.periodo_dias) {
        const limite = subDays(new Date(), filtros.periodo_dias).toISOString();
        q = q.gte("created_at", limite);
      }
      if (filtros.busca && filtros.busca.trim()) {
        const b = filtros.busca.trim().replace(/[%_]/g, "");
        q = q.or(`titulo.ilike.%${b}%,protocolo.ilike.%${b}%,resumo.ilike.%${b}%`);
      }

      const col = ORDER_MAP[ordenacao.campo] ?? "ultima_interacao_em";
      q = q.order(col, { ascending: ordenacao.dir === "asc", nullsFirst: false });

      const from = page * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error, count } = await q;
      if (error) throw error;

      const { tickets, nomes } = await enriquecerCompleto(data as any[]);
      return { tickets, total: count ?? 0, nomes };
    },
  });
}
