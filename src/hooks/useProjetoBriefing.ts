import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BriefingCampo {
  id: string;
  briefing_id: string;
  categoria: string;
  campo: string;
  valor: string | null;
  responsabilidade: string | null;
  ordem: number;
}

export interface Briefing {
  id: string;
  projeto_id: string;
  secao_id: string | null;
  tarefa_id: string | null;
  nome_arquivo: string;
  status: string;
  aprovado_por: string | null;
  aprovado_em: string | null;
  observacao_aprovacao: string | null;
  created_at: string;
  user_id: string;
  campos?: BriefingCampo[];
}

/** Hook to manage a single briefing linked to a tarefa (or secao for backward compat) */
export function useProjetoBriefing(tarefaId: string | undefined, secaoId?: string | undefined) {
  const queryClient = useQueryClient();
  const key = tarefaId || secaoId;
  const queryKey = ["projeto-briefing", key];

  const { data: briefing, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!key) return null;

      let query = supabase
        .from("projeto_briefings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (tarefaId) {
        query = query.eq("tarefa_id", tarefaId);
      } else if (secaoId) {
        query = query.eq("secao_id", secaoId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: campos, error: camposError } = await supabase
        .from("projeto_briefing_campos")
        .select("*")
        .eq("briefing_id", data.id)
        .order("ordem", { ascending: true });
      if (camposError) throw camposError;

      return { ...data, campos: campos || [] } as Briefing;
    },
    enabled: !!key,
  });

  const saveBriefing = useMutation({
    mutationFn: async (params: {
      projetoId: string;
      secaoId?: string;
      tarefaId?: string;
      nomeArquivo: string;
      campos: { categoria: string; campo: string; valor: string; responsabilidade?: string }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Delete existing briefing for this target
      let existingQuery = supabase.from("projeto_briefings").select("id");
      if (params.tarefaId) {
        existingQuery = existingQuery.eq("tarefa_id", params.tarefaId);
      } else if (params.secaoId) {
        existingQuery = existingQuery.eq("secao_id", params.secaoId);
      }
      const { data: existing } = await existingQuery;

      if (existing && existing.length > 0) {
        for (const b of existing) {
          await supabase.from("projeto_briefing_campos").delete().eq("briefing_id", b.id);
          await supabase.from("projeto_briefings").delete().eq("id", b.id);
        }
      }

      // Create new briefing
      const insertData: any = {
        projeto_id: params.projetoId,
        nome_arquivo: params.nomeArquivo,
        user_id: user.id,
        status: "pendente",
      };
      if (params.tarefaId) insertData.tarefa_id = params.tarefaId;
      if (params.secaoId) insertData.secao_id = params.secaoId;

      const { data: briefing, error: bError } = await supabase
        .from("projeto_briefings")
        .insert(insertData)
        .select()
        .single();
      if (bError) throw bError;

      const camposToInsert = params.campos.map((c, i) => ({
        briefing_id: briefing.id,
        categoria: c.categoria,
        campo: c.campo,
        valor: c.valor,
        responsabilidade: c.responsabilidade || null,
        ordem: i,
      }));

      const { error: cError } = await supabase
        .from("projeto_briefing_campos")
        .insert(camposToInsert);
      if (cError) throw cError;

      return briefing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["projeto-briefings"] });
      toast.success("Briefing salvo com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar briefing: " + err.message);
    },
  });

  const deleteBriefing = useMutation({
    mutationFn: async (briefingId: string) => {
      await supabase.from("projeto_briefing_campos").delete().eq("briefing_id", briefingId);
      const { error } = await supabase.from("projeto_briefings").delete().eq("id", briefingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["projeto-briefings"] });
      toast.success("Briefing removido.");
    },
  });

  return { briefing, isLoading, saveBriefing, deleteBriefing };
}
