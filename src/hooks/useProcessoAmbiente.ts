import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Hook para ações do Ambiente do Processo — reutilizável em qualquer módulo.
 * Oferece: ciência, juntada, aprovação, rejeição, submissão, contestação e réplica.
 */
export function useProcessoAmbiente(processId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["process-events", processId] });
    queryClient.invalidateQueries({ queryKey: ["unified-timeline"] });
    queryClient.invalidateQueries({ queryKey: ["despachos-processo", processId] });
  };

  const getUserProfile = async () => {
    if (!user?.id) return { id: user?.id, nome: user?.email || "Usuário" };
    const { data } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();
    return { id: user.id, nome: data?.nome || user.email || "Usuário" };
  };

  const registrarEvento = async (params: {
    tipo_evento: string;
    descricao: string;
    modulo_origem: string;
    metadata?: Record<string, any>;
  }) => {
    if (!processId) throw new Error("Processo não vinculado");
    const profile = await getUserProfile();
    const { error } = await (supabase
      .from("process_events" as any)
      .insert({
        process_id: processId,
        tipo_evento: params.tipo_evento,
        descricao: params.descricao,
        modulo_origem: params.modulo_origem,
        usuario_id: profile.id,
        usuario_nome: profile.nome,
        metadata: params.metadata || {},
      }) as any);
    if (error) throw error;
  };

  // 1. Dar Ciência
  const darCiencia = useMutation({
    mutationFn: async (input: { despacho_id: string; modulo_origem: string }) => {
      const profile = await getUserProfile();
      const { error } = await (supabase
        .from("process_despacho_documento" as any)
        .update({
          ciencia_em: new Date().toISOString(),
          ciencia_por: profile.id,
          ciencia_por_nome: profile.nome,
        })
        .eq("id", input.despacho_id) as any);
      if (error) throw error;

      await (supabase.from("process_despacho_transicoes" as any).insert({
        despacho_id: input.despacho_id,
        etapa_nome: "Ciência",
        acao: "ciencia",
        usuario_id: profile.id,
        usuario_nome: profile.nome,
      }) as any);

      await registrarEvento({
        tipo_evento: "ciencia",
        descricao: `${profile.nome} deu ciência no módulo ${input.modulo_origem}`,
        modulo_origem: input.modulo_origem,
        metadata: { despacho_id: input.despacho_id },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Ciência registrada"); },
    onError: (e: any) => toast.error("Erro ao dar ciência: " + e.message),
  });

  // 2. Juntada de documento
  const juntarDocumento = useMutation({
    mutationFn: async (input: {
      titulo: string;
      arquivo_path?: string;
      tipo_documento: string;
      modulo_origem: string;
      observacao?: string;
    }) => {
      const profile = await getUserProfile();
      await registrarEvento({
        tipo_evento: "juntada",
        descricao: `${profile.nome} juntou "${input.titulo}" (${input.tipo_documento})`,
        modulo_origem: input.modulo_origem,
        metadata: {
          titulo: input.titulo,
          tipo_documento: input.tipo_documento,
          arquivo_path: input.arquivo_path,
          observacao: input.observacao,
        },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Documento juntado ao processo"); },
    onError: (e: any) => toast.error("Erro na juntada: " + e.message),
  });

  // 3. Aprovar
  const aprovar = useMutation({
    mutationFn: async (input: {
      despacho_id?: string;
      item_descricao: string;
      modulo_origem: string;
      observacao?: string;
    }) => {
      const profile = await getUserProfile();
      if (input.despacho_id) {
        await (supabase.from("process_despacho_documento" as any)
          .update({ status: "aprovado", parecer_texto: input.observacao || "Aprovado", parecer_por: profile.id, parecer_por_nome: profile.nome, parecer_data: new Date().toISOString() })
          .eq("id", input.despacho_id) as any);

        await (supabase.from("process_despacho_transicoes" as any).insert({
          despacho_id: input.despacho_id, etapa_nome: "Parecer", acao: "aprovar",
          usuario_id: profile.id, usuario_nome: profile.nome, observacao: input.observacao,
        }) as any);
      }
      await registrarEvento({
        tipo_evento: "aprovacao",
        descricao: `${profile.nome} aprovou: ${input.item_descricao}`,
        modulo_origem: input.modulo_origem,
        metadata: { despacho_id: input.despacho_id, observacao: input.observacao },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Aprovação registrada"); },
    onError: (e: any) => toast.error("Erro ao aprovar: " + e.message),
  });

  // 4. Rejeitar
  const rejeitar = useMutation({
    mutationFn: async (input: {
      despacho_id?: string;
      item_descricao: string;
      modulo_origem: string;
      motivo: string;
    }) => {
      const profile = await getUserProfile();
      if (input.despacho_id) {
        await (supabase.from("process_despacho_documento" as any)
          .update({ status: "rejeitado", parecer_texto: input.motivo, parecer_por: profile.id, parecer_por_nome: profile.nome, parecer_data: new Date().toISOString() })
          .eq("id", input.despacho_id) as any);

        await (supabase.from("process_despacho_transicoes" as any).insert({
          despacho_id: input.despacho_id, etapa_nome: "Parecer", acao: "rejeitar",
          usuario_id: profile.id, usuario_nome: profile.nome, observacao: input.motivo,
        }) as any);
      }
      await registrarEvento({
        tipo_evento: "rejeicao",
        descricao: `${profile.nome} rejeitou: ${input.item_descricao} — Motivo: ${input.motivo}`,
        modulo_origem: input.modulo_origem,
        metadata: { despacho_id: input.despacho_id, motivo: input.motivo },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Rejeição registrada"); },
    onError: (e: any) => toast.error("Erro ao rejeitar: " + e.message),
  });

  // 5. Submeter (enviar para próxima fase)
  const submeter = useMutation({
    mutationFn: async (input: {
      destino_modulo: string;
      modulo_origem: string;
      descricao: string;
      observacao?: string;
    }) => {
      const profile = await getUserProfile();
      await registrarEvento({
        tipo_evento: "submissao",
        descricao: `${profile.nome} submeteu de ${input.modulo_origem} para ${input.destino_modulo}: ${input.descricao}`,
        modulo_origem: input.modulo_origem,
        metadata: { destino: input.destino_modulo, observacao: input.observacao },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Submissão registrada"); },
    onError: (e: any) => toast.error("Erro ao submeter: " + e.message),
  });

  // 6. Contestar (discordar de decisão)
  const contestar = useMutation({
    mutationFn: async (input: {
      despacho_id?: string;
      decision_id?: string;
      modulo_origem: string;
      motivo: string;
    }) => {
      const profile = await getUserProfile();
      if (input.despacho_id) {
        await (supabase.from("process_despacho_transicoes" as any).insert({
          despacho_id: input.despacho_id, etapa_nome: "Contestação", acao: "contestar",
          usuario_id: profile.id, usuario_nome: profile.nome, observacao: input.motivo,
        }) as any);
      }
      await registrarEvento({
        tipo_evento: "contestacao",
        descricao: `${profile.nome} contestou: ${input.motivo}`,
        modulo_origem: input.modulo_origem,
        metadata: { despacho_id: input.despacho_id, decision_id: input.decision_id, motivo: input.motivo },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Contestação registrada"); },
    onError: (e: any) => toast.error("Erro ao contestar: " + e.message),
  });

  // 7. Replicar (responder a contestação)
  const replicar = useMutation({
    mutationFn: async (input: {
      despacho_id?: string;
      modulo_origem: string;
      resposta: string;
    }) => {
      const profile = await getUserProfile();
      if (input.despacho_id) {
        await (supabase.from("process_despacho_transicoes" as any).insert({
          despacho_id: input.despacho_id, etapa_nome: "Réplica", acao: "replicar",
          usuario_id: profile.id, usuario_nome: profile.nome, observacao: input.resposta,
        }) as any);
      }
      await registrarEvento({
        tipo_evento: "replica",
        descricao: `${profile.nome} replicou: ${input.resposta}`,
        modulo_origem: input.modulo_origem,
        metadata: { despacho_id: input.despacho_id, resposta: input.resposta },
      });
    },
    onSuccess: () => { invalidateAll(); toast.success("Réplica registrada"); },
    onError: (e: any) => toast.error("Erro ao replicar: " + e.message),
  });

  return {
    darCiencia,
    juntarDocumento,
    aprovar,
    rejeitar,
    submeter,
    contestar,
    replicar,
  };
}
