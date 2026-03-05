import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Briefing, BriefingCampo } from "./useProjetoBriefing";

export interface BriefingWithContext extends Briefing {
  tarefa_titulo?: string;
  tarefa_codigo?: string;
  produto_nome?: string;
  produto_foto_url?: string;
  produto_codigo?: string;
  campos_count?: number;
}

export function useProjetoBriefings(projetoId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["projeto-briefings", projetoId];

  const { data: briefings = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projetoId) return [];

      // Fetch all briefings for this project
      const { data: rawBriefings, error } = await supabase
        .from("projeto_briefings")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!rawBriefings || rawBriefings.length === 0) return [];

      // Get tarefa info for linked briefings
      const tarefaIds = rawBriefings
        .map(b => b.tarefa_id)
        .filter(Boolean) as string[];

      let tarefaMap: Record<string, any> = {};
      if (tarefaIds.length > 0) {
        const { data: tarefas } = await supabase
          .from("projeto_tarefas")
          .select("id, titulo, codigo, produto_id")
          .in("id", tarefaIds);

        if (tarefas) {
          for (const t of tarefas) {
            tarefaMap[t.id] = t;
          }
        }

        // Get product info
        const produtoIds = tarefas
          ?.map(t => t.produto_id)
          .filter(Boolean) as string[] || [];

        if (produtoIds.length > 0) {
          const { data: produtos } = await supabase
            .from("fabrica_produtos")
            .select("id, nome, foto_url, codigo")
            .in("id", produtoIds);

          if (produtos) {
            for (const t of tarefas || []) {
              if (t.produto_id) {
                const prod = produtos.find(p => p.id === t.produto_id);
                if (prod) {
                  tarefaMap[t.id] = { ...tarefaMap[t.id], produto: prod };
                }
              }
            }
          }
        }
      }

      // Get campos count per briefing
      const briefingIds = rawBriefings.map(b => b.id);
      const { data: allCampos } = await supabase
        .from("projeto_briefing_campos")
        .select("briefing_id")
        .in("briefing_id", briefingIds);

      const camposCountMap: Record<string, number> = {};
      if (allCampos) {
        for (const c of allCampos) {
          camposCountMap[c.briefing_id] = (camposCountMap[c.briefing_id] || 0) + 1;
        }
      }

      return rawBriefings.map(b => {
        const tarefa = b.tarefa_id ? tarefaMap[b.tarefa_id] : null;
        const produto = tarefa?.produto;
        return {
          ...b,
          tarefa_titulo: tarefa?.titulo,
          tarefa_codigo: tarefa?.codigo,
          produto_nome: produto?.nome,
          produto_foto_url: produto?.foto_url,
          produto_codigo: produto?.codigo,
          campos_count: camposCountMap[b.id] || 0,
        } as BriefingWithContext;
      });
    },
    enabled: !!projetoId,
  });

  const updateBriefingStatus = useMutation({
    mutationFn: async (params: {
      briefingId: string;
      status: string;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const updates: any = { status: params.status };
      if (params.status === "aprovado" || params.status === "rejeitado") {
        updates.aprovado_por = user.id;
        updates.aprovado_em = new Date().toISOString();
      }
      if (params.observacao) {
        updates.observacao_aprovacao = params.observacao;
      }

      const { error } = await supabase
        .from("projeto_briefings")
        .update(updates)
        .eq("id", params.briefingId);

      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey });
      const msg = params.status === "aprovado" ? "Briefing aprovado!" : 
                  params.status === "rejeitado" ? "Briefing rejeitado." : "Status atualizado.";
      toast.success(msg);
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar status: " + err.message);
    },
  });

  // Load campos for a specific briefing (for expanded detail)
  const loadCampos = async (briefingId: string): Promise<BriefingCampo[]> => {
    const { data, error } = await supabase
      .from("projeto_briefing_campos")
      .select("*")
      .eq("briefing_id", briefingId)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return (data || []) as BriefingCampo[];
  };

  return { briefings, isLoading, updateBriefingStatus, loadCampos };
}
