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
  secao_id: string;
  nome_arquivo: string;
  created_at: string;
  user_id: string;
  campos?: BriefingCampo[];
}

export function useProjetoBriefing(secaoId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["projeto-briefing", secaoId];

  const { data: briefing, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!secaoId) return null;
      const { data, error } = await supabase
        .from("projeto_briefings")
        .select("*")
        .eq("secao_id", secaoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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
    enabled: !!secaoId,
  });

  const saveBriefing = useMutation({
    mutationFn: async (params: {
      projetoId: string;
      secaoId: string;
      nomeArquivo: string;
      campos: { categoria: string; campo: string; valor: string; responsabilidade?: string }[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Delete existing briefing for this section
      const { data: existing } = await supabase
        .from("projeto_briefings")
        .select("id")
        .eq("secao_id", params.secaoId);
      
      if (existing && existing.length > 0) {
        for (const b of existing) {
          await supabase.from("projeto_briefing_campos").delete().eq("briefing_id", b.id);
          await supabase.from("projeto_briefings").delete().eq("id", b.id);
        }
      }

      // Create new briefing
      const { data: briefing, error: bError } = await supabase
        .from("projeto_briefings")
        .insert({
          projeto_id: params.projetoId,
          secao_id: params.secaoId,
          nome_arquivo: params.nomeArquivo,
          user_id: user.id,
        })
        .select()
        .single();
      if (bError) throw bError;

      // Insert campos
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
      toast.success("Briefing removido.");
    },
  });

  return { briefing, isLoading, saveBriefing, deleteBriefing };
}
