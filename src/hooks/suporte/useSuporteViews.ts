import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SuporteViewFiltros {
  status?: string;
  categoria?: string;
  prioridade?: string;
  fila_id?: string;
  assignee_id?: string;
  sem_responsavel?: boolean;
  sla_violado?: boolean;
  busca?: string;
  periodo_dias?: number;
}

export interface SuporteViewOrdenacao {
  campo: string;
  dir: "asc" | "desc";
}

export interface SuporteView {
  id: string;
  owner_id: string;
  nome: string;
  escopo: "pessoal" | "fila";
  fila_id: string | null;
  filtros: SuporteViewFiltros;
  colunas: string[];
  ordenacao: SuporteViewOrdenacao;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useSuporteViews(filaIds: string[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["suporte", "views", user?.id, [...filaIds].sort().join(",")];

  const query = useQuery({
    queryKey: key,
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("suporte_views" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (filaIds.length > 0) {
        q = q.or(
          `owner_id.eq.${user!.id},and(escopo.eq.fila,fila_id.in.(${filaIds.join(",")}))`,
        );
      } else {
        q = q.eq("owner_id", user!.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown) as SuporteView[];
    },
  });

  const criar = useMutation({
    mutationFn: async (input: Omit<SuporteView, "id" | "owner_id" | "created_at" | "updated_at" | "is_default"> & { is_default?: boolean }) => {
      const { data, error } = await (supabase.from("suporte_views" as any).insert({
        owner_id: user!.id,
        nome: input.nome,
        escopo: input.escopo,
        fila_id: input.escopo === "fila" ? input.fila_id : null,
        filtros: input.filtros,
        colunas: input.colunas,
        ordenacao: input.ordenacao,
        is_default: input.is_default ?? false,
      }).select("*").single());
      if (error) throw error;
      return data as unknown as SuporteView;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "views"] });
      toast.success("View salva");
    },
    onError: (err: Error) => toast.error("Erro ao salvar view", { description: err.message }),
  });

  const atualizar = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<SuporteView> }) => {
      const { error } = await (supabase.from("suporte_views" as any)
        .update(input.patch as any)
        .eq("id", input.id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suporte", "views"] }),
    onError: (err: Error) => toast.error("Erro ao atualizar view", { description: err.message }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("suporte_views" as any).delete().eq("id", id));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suporte", "views"] });
      toast.success("View removida");
    },
    onError: (err: Error) => toast.error("Erro ao remover view", { description: err.message }),
  });

  return { ...query, criar, atualizar, remover };
}
