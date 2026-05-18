import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeChat } from "@/lib/ai/invokeChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SugestaoTarefa {
  titulo: string;
  descricao: string;
  data_prazo: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  responsavel_sugerido: string | null;
}

export interface CriarTarefaInput {
  mensagem_id: string;
  projeto_id: string;
  secao_id?: string;
  titulo?: string;
  descricao?: string;
  responsavel_id?: string | null;
  data_prazo?: string | null;
  prioridade?: "baixa" | "media" | "alta" | "urgente";
  copiar_anexos?: boolean;
}

export function useSugestaoTarefaChat(mensagemId: string | null, projetoId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["chat-tarefa-sugestao", mensagemId, projetoId],
    enabled: enabled && !!mensagemId && !!projetoId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await invokeChat<{ sugestao: SugestaoTarefa }>(
        "chat-criar-tarefa-do-chat",
        {
          mensagem_id: mensagemId,
          projeto_id: projetoId,
          apenas_sugerir: true,
        },
        { timeoutMs: 35_000 },
      );
      if (error) throw new Error(error.userMessage);
      return data!.sugestao;
    },
  });
}

export function useCriarTarefaDoChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CriarTarefaInput) => {
      const { data, error } = await invokeChat<{
        tarefa: { id: string; projeto_id: string; titulo: string; codigo: string | null };
        anexos_copiados: number;
      }>("chat-criar-tarefa-do-chat", input as any, { timeoutMs: 60_000 });
      if (error) throw new Error(error.userMessage);
      return data!;
    },
    onSuccess: (res) => {
      toast.success(
        `Tarefa criada${res.anexos_copiados ? ` (${res.anexos_copiados} anexo(s) copiados)` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["minhas-tarefas"] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas"] });
      qc.invalidateQueries({ queryKey: ["mensagens"] });
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Falha ao criar tarefa");
    },
  });
}

export function useProjetosDoUsuario() {
  return useQuery({
    queryKey: ["chat-projetos-usuario"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("projeto_membros")
        .select("projeto_id, projetos(id, nome, cor, status)")
        .eq("user_id", user.id);
      return (data ?? [])
        .map((m: any) => m.projetos)
        .filter((p: any) => p && p.status !== "arquivado")
        .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    },
  });
}
