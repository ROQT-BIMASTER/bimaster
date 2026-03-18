import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface DespachoDocumento {
  id: string;
  submissao_id: string;
  documento_id: string;
  processo_id: string | null;
  numero_anexo: number;
  categoria_checklist: string | null;
  departamento_destino_id: string | null;
  modulo_destino: string | null;
  status: string;
  parecer_texto: string | null;
  parecer_por: string | null;
  parecer_por_nome: string | null;
  parecer_data: string | null;
  devolvido_china: boolean;
  devolvido_china_data: string | null;
  workflow_config_id: string | null;
  etapa_atual: number;
  created_by: string | null;
  created_at: string;
}

export interface DespachoTransicao {
  id: string;
  despacho_id: string;
  etapa_nome: string | null;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  departamento_id: string | null;
  observacao: string | null;
  created_at: string;
}

export function useDespachosPorSubmissao(submissaoId: string | null) {
  return useQuery({
    queryKey: ["despachos-submissao", submissaoId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_despacho_documento" as any)
        .select("*")
        .eq("submissao_id", submissaoId!)
        .order("numero_anexo") as any);
      if (error) throw error;
      return (data || []) as DespachoDocumento[];
    },
    enabled: !!submissaoId,
  });
}

export function useDespachosPorProcesso(processoId: string | null) {
  return useQuery({
    queryKey: ["despachos-processo", processoId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_despacho_documento" as any)
        .select("*")
        .eq("processo_id", processoId!)
        .order("numero_anexo") as any);
      if (error) throw error;
      return (data || []) as DespachoDocumento[];
    },
    enabled: !!processoId,
  });
}

export function useCriarDespachoLote() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      submissao_id: string;
      documento_ids: string[];
      processo_id?: string;
      categorias_checklist?: Record<string, string>;
      modulo_destino?: string;
      workflow_config_id?: string;
      observacao?: string;
      prazo_ciencia_horas?: number;
    }) => {
      const loteId = crypto.randomUUID();

      // Get next anexo number
      const { data: existing } = await (supabase
        .from("process_despacho_documento" as any)
        .select("numero_anexo")
        .eq("submissao_id", input.submissao_id)
        .order("numero_anexo", { ascending: false })
        .limit(1) as any);

      let nextAnexo = existing && existing.length > 0 ? (existing[0] as any).numero_anexo + 1 : 1;

      const results: DespachoDocumento[] = [];

      for (const docId of input.documento_ids) {
        const { data, error } = await (supabase
          .from("process_despacho_documento" as any)
          .insert({
            submissao_id: input.submissao_id,
            documento_id: docId,
            processo_id: input.processo_id || null,
            numero_anexo: nextAnexo,
            categoria_checklist: input.categorias_checklist?.[docId] || null,
            modulo_destino: input.modulo_destino || null,
            workflow_config_id: input.workflow_config_id || null,
            status: "pendente",
            prazo_ciencia_horas: input.prazo_ciencia_horas || 48,
            lote_despacho_id: loteId,
            created_by: user?.id,
          })
          .select()
          .single() as any);
        if (error) throw error;

        // Transition record
        await (supabase
          .from("process_despacho_transicoes" as any)
          .insert({
            despacho_id: (data as any).id,
            etapa_nome: "Despacho Inicial",
            acao: "despachar",
            usuario_id: user?.id,
            usuario_nome: user?.email,
            observacao: input.observacao || null,
          }) as any);

        // Create process event if processo_id exists
        if (input.processo_id) {
          await (supabase
            .from("process_events" as any)
            .insert({
              processo_id: input.processo_id,
              tipo: "despacho",
              descricao: `Documento despachado para ${input.modulo_destino || "módulo"} — Anexo ${String(nextAnexo).padStart(2, "0")}`,
              usuario_id: user?.id,
              usuario_nome: user?.email,
              metadata: { despacho_id: (data as any).id, documento_id: docId, modulo: input.modulo_destino, prazo_horas: input.prazo_ciencia_horas || 48 },
            }) as any);
        }

        results.push(data as DespachoDocumento);
        nextAnexo++;
      }

      return results;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["despachos-submissao", vars.submissao_id] });
      queryClient.invalidateQueries({ queryKey: ["despachos-processo"] });
      queryClient.invalidateQueries({ queryKey: ["process-events"] });
      toast.success(`${vars.documento_ids.length} documento(s) despachado(s)`);
    },
  });
}

// Keep single dispatch as convenience wrapper
export function useCriarDespacho() {
  const lote = useCriarDespachoLote();
  return {
    ...lote,
    mutateAsync: async (input: {
      submissao_id: string;
      documento_id: string;
      processo_id?: string;
      categoria_checklist?: string;
      modulo_destino?: string;
      workflow_config_id?: string;
      observacao?: string;
    }) => {
      const results = await lote.mutateAsync({
        submissao_id: input.submissao_id,
        documento_ids: [input.documento_id],
        processo_id: input.processo_id,
        categorias_checklist: input.categoria_checklist ? { [input.documento_id]: input.categoria_checklist } : undefined,
        modulo_destino: input.modulo_destino,
        workflow_config_id: input.workflow_config_id,
        observacao: input.observacao,
      });
      return results[0];
    },
    isPending: lote.isPending,
  };
}

export function useRegistrarParecer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      despacho_id: string;
      acao: "aprovar" | "rejeitar" | "pendencia" | "encaminhar";
      parecer_texto: string;
      novo_departamento_id?: string;
    }) => {
      const statusMap: Record<string, string> = {
        aprovar: "aprovado",
        rejeitar: "rejeitado",
        pendencia: "pendente",
        encaminhar: "em_analise",
      };

      const update: any = {
        status: statusMap[input.acao] || "pendente",
        parecer_texto: input.parecer_texto,
        parecer_por: user?.id,
        parecer_por_nome: user?.email,
        parecer_data: new Date().toISOString(),
      };

      if (input.novo_departamento_id) {
        update.departamento_destino_id = input.novo_departamento_id;
      }

      const { error } = await (supabase
        .from("process_despacho_documento" as any)
        .update(update)
        .eq("id", input.despacho_id) as any);
      if (error) throw error;

      // Transition record
      await (supabase
        .from("process_despacho_transicoes" as any)
        .insert({
          despacho_id: input.despacho_id,
          etapa_nome: `Parecer: ${input.acao}`,
          acao: input.acao,
          usuario_id: user?.id,
          usuario_nome: user?.email,
          departamento_id: input.novo_departamento_id || null,
          observacao: input.parecer_texto,
        }) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despachos-submissao"] });
      queryClient.invalidateQueries({ queryKey: ["despachos-processo"] });
      toast.success("Parecer registrado");
    },
  });
}

export function useDevolverChina() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: { despacho_id: string; documento_id: string }) => {
      // Mark despacho as returned
      const { error } = await (supabase
        .from("process_despacho_documento" as any)
        .update({
          devolvido_china: true,
          devolvido_china_data: new Date().toISOString(),
          status: "devolvido_china",
        })
        .eq("id", input.despacho_id) as any);
      if (error) throw error;

      // Update original china document status
      await supabase
        .from("china_produto_documentos")
        .update({ status: "aprovado" } as any)
        .eq("id", input.documento_id);

      // Transition record
      await (supabase
        .from("process_despacho_transicoes" as any)
        .insert({
          despacho_id: input.despacho_id,
          etapa_nome: "Devolução à China",
          acao: "devolver_china",
          usuario_id: user?.id,
          usuario_nome: user?.email,
          observacao: "Documento aprovado e devolvido à China",
        }) as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["despachos-submissao"] });
      queryClient.invalidateQueries({ queryKey: ["despachos-processo"] });
      toast.success("Documento devolvido à China como aprovado");
    },
  });
}

export function useTransicoesDespacho(despachoId: string | null) {
  return useQuery({
    queryKey: ["despacho-transicoes", despachoId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("process_despacho_transicoes" as any)
        .select("*")
        .eq("despacho_id", despachoId!)
        .order("created_at", { ascending: true }) as any);
      if (error) throw error;
      return (data || []) as DespachoTransicao[];
    },
    enabled: !!despachoId,
  });
}
