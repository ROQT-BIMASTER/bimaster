import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface HoraLancamento {
  id: string;
  projeto_id: string;
  tarefa_id: string | null;
  user_id: string;
  data: string;
  horas: number;
  descricao: string | null;
  custo_hora_snapshot: number;
  origem: "manual" | "ia_backfill" | "importacao";
  created_at: string;
  autor?: { nome: string | null } | null;
  tarefa?: { titulo: string } | null;
}

export function useProjetoHoras(projetoId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKey = ["projeto-horas", projetoId];

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey,
    enabled: !!projetoId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projeto_horas_lancamentos")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("data", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data || []) as HoraLancamento[];
      const userIds = [...new Set(list.map((l) => l.user_id))];
      const tIds = [...new Set(list.map((l) => l.tarefa_id).filter(Boolean))] as string[];
      const [{ data: profs }, { data: tarefas }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, nome").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
        tIds.length ? (supabase as any).from("projeto_tarefas").select("id, titulo").in("id", tIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pm = new Map((profs || []).map((p: any) => [p.id, p]));
      const tm = new Map((tarefas || []).map((t: any) => [t.id, t]));
      return list.map((l) => ({
        ...l,
        autor: pm.get(l.user_id) ?? null,
        tarefa: l.tarefa_id ? tm.get(l.tarefa_id) ?? null : null,
      }));
    },
  });

  const registrar = useMutation({
    mutationFn: async (input: { horas: number; descricao?: string; tarefa_id?: string | null; data?: string }) => {
      if (!projetoId || !user?.id) throw new Error("Sem projeto/usuário");
      const { error } = await (supabase as any).from("projeto_horas_lancamentos").insert({
        projeto_id: projetoId,
        tarefa_id: input.tarefa_id ?? null,
        user_id: user.id,
        horas: input.horas,
        descricao: input.descricao ?? null,
        data: input.data ?? new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["projeto-produtividade", projetoId] });
      toast.success("Horas registradas");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("projeto_horas_lancamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return { lancamentos, isLoading, registrar, remover };
}

export function useProjetoProdutividade(projetoId: string | null) {
  return useQuery({
    queryKey: ["projeto-produtividade", projetoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const [prod, rateio] = await Promise.all([
        (supabase as any).from("vw_projeto_produtividade").select("*").eq("projeto_id", projetoId),
        (supabase as any).from("vw_projeto_rateio_tecnologia").select("*").eq("projeto_id", projetoId),
      ]);
      return {
        meses: (prod.data || []) as { mes: string; horas_totais: number; custo_pessoas: number; pessoas_ativas: number }[],
        tecnologia: (rateio.data || []) as { mes: string; custo_tecnologia_rateado: number }[],
      };
    },
  });
}
