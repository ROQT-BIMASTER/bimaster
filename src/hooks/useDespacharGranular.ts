import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { DespachoDestino } from "@/lib/validations/despachoDocumento";

export interface DespacharDocPayload {
  submissao_id: string;
  documento_id: string;
  documento_nome?: string;
  destinos: DespachoDestino[];
  prazo_sla: string; // YYYY-MM-DD
  prazo_origem: "tarefa" | "tipo_doc" | "manual" | "default";
  sla_horas_uteis?: number | null;
  prioridade?: "normal" | "alta" | "critica";
  observacao?: string;
}

async function ensureProcess(submissaoId: string, userId?: string | null): Promise<string | null> {
  const { data: existing } = await (supabase
    .from("product_process" as any)
    .select("id")
    .eq("produto_tipo", "china")
    .eq("produto_ref_id", submissaoId)
    .maybeSingle() as any);
  if (existing?.id) return existing.id as string;
  const { data: created } = await (supabase
    .from("product_process" as any)
    .insert({ produto_tipo: "china", produto_ref_id: submissaoId, criado_por: userId, etapa_atual: "projeto" })
    .select("id")
    .single() as any);
  return created?.id ?? null;
}

export function useDespacharDoc() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: DespacharDocPayload) => {
      const loteId = crypto.randomUUID();
      const processId = await ensureProcess(input.submissao_id, user?.id);

      // próximo número de anexo
      const { data: existing } = await (supabase
        .from("process_despacho_documento" as any)
        .select("numero_anexo")
        .eq("submissao_id", input.submissao_id)
        .order("numero_anexo", { ascending: false })
        .limit(1) as any);
      let nextAnexo = existing?.[0]?.numero_anexo ? existing[0].numero_anexo + 1 : 1;

      const created: any[] = [];

      for (const destino of input.destinos) {
        const row: any = {
          submissao_id: input.submissao_id,
          documento_id: input.documento_id,
          processo_id: processId,
          numero_anexo: nextAnexo++,
          status: "pendente",
          prazo_ciencia_horas: 48,
          lote_despacho_id: loteId,
          created_by: user?.id,
          prazo_sla: input.prazo_sla,
          prazo_origem: input.prazo_origem,
          sla_horas_uteis: input.sla_horas_uteis ?? null,
          prioridade: input.prioridade ?? "normal",
          modulo_destino: destino.modulo_destino ?? null,
          vinculo_projeto_id: destino.projeto_id ?? null,
          vinculo_tarefa_id: destino.tarefa_id ?? null,
          despachado_para_nome:
            destino.responsavel_nome ||
            destino.tarefa_titulo ||
            destino.projeto_nome ||
            destino.modulo_destino ||
            null,
        };
        const { data, error } = await (supabase
          .from("process_despacho_documento" as any)
          .insert(row)
          .select()
          .single() as any);
        if (error) throw error;
        created.push(data);

        // transição inicial
        await (supabase.from("process_despacho_transicoes" as any).insert({
          despacho_id: (data as any).id,
          etapa_nome: "Despacho Inicial",
          acao: "despachar",
          usuario_id: user?.id,
          usuario_nome: user?.email,
          observacao: input.observacao || null,
        }) as any);

        // process_event
        if (processId) {
          await (supabase.from("process_events" as any).insert({
            process_id: processId,
            tipo_evento: "despacho",
            descricao: `Despachado: ${input.documento_nome ?? input.documento_id} → ${row.despachado_para_nome ?? "destino"}`,
            modulo_origem: "vincular_china",
            usuario_id: user?.id,
            usuario_nome: user?.email,
            metadata: {
              despacho_id: (data as any).id,
              documento_id: input.documento_id,
              destino,
              prazo_sla: input.prazo_sla,
              prazo_origem: input.prazo_origem,
              prioridade: input.prioridade ?? "normal",
            },
          }) as any);
        }

        // Notificação ao responsável (quando aplicável)
        if (destino.responsavel_id && destino.responsavel_id !== user?.id) {
          await supabase.from("notifications").insert({
            user_id: destino.responsavel_id,
            type: "china_despacho_documento",
            title: `Despacho de documento da China`,
            message: `Você recebeu o documento ${input.documento_nome ?? ""} com prazo até ${input.prazo_sla}.`,
            action_url: `/dashboard/projetos/vincular-china?sub=${input.submissao_id}`,
          } as any);
        }
        if (destino.tarefa_id) {
          const { data: t } = await supabase
            .from("projeto_tarefas")
            .select("responsavel_id")
            .eq("id", destino.tarefa_id)
            .maybeSingle();
          if (t?.responsavel_id && t.responsavel_id !== user?.id) {
            await supabase.from("notifications").insert({
              user_id: t.responsavel_id,
              type: "china_despacho_documento",
              title: `Documento despachado para sua tarefa`,
              message: `${input.documento_nome ?? "Documento"} chegou com prazo ${input.prazo_sla}.`,
              action_url: `/dashboard/projetos/${destino.projeto_id}?tarefa=${destino.tarefa_id}`,
            } as any);
          }
        }
      }

      // Recalcular alertas
      try {
        await (supabase.rpc as any)("rpc_recalcular_alertas_china", { _submissao_id: input.submissao_id });
      } catch { /* noop */ }

      return created;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Documento despachado para ${vars.destinos.length} destino(s)`);
      qc.invalidateQueries({ queryKey: ["despachos-submissao", vars.submissao_id] });
      qc.invalidateQueries({ queryKey: ["china-dispatch-history"] });
      qc.invalidateQueries({ queryKey: ["china-doc-alertas"] });
      qc.invalidateQueries({ queryKey: ["china-sla"] });
    },
    onError: (e: any) => toast.error("Falha ao despachar", { description: e?.message }),
  });
}

export function useDespacharLote() {
  const qc = useQueryClient();
  const single = useDespacharDoc();

  return useMutation({
    mutationFn: async (input: {
      submissao_id: string;
      documentos: { id: string; nome?: string; tipo?: string }[];
      destinos: DespachoDestino[];
      prazo_sla: string;
      prazo_origem: "tarefa" | "tipo_doc" | "manual" | "default";
      sla_horas_uteis?: number | null;
      prioridade?: "normal" | "alta" | "critica";
      observacao?: string;
    }) => {
      for (const doc of input.documentos) {
        await single.mutateAsync({
          submissao_id: input.submissao_id,
          documento_id: doc.id,
          documento_nome: doc.nome,
          destinos: input.destinos,
          prazo_sla: input.prazo_sla,
          prazo_origem: input.prazo_origem,
          sla_horas_uteis: input.sla_horas_uteis,
          prioridade: input.prioridade,
          observacao: input.observacao,
        });
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.documentos.length} documento(s) despachado(s)`);
      qc.invalidateQueries({ queryKey: ["despachos-submissao", vars.submissao_id] });
    },
  });
}

// Lista alertas (com realtime)
export function useChinaAlertas(submissaoId?: string | null) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["china-doc-alertas", submissaoId ?? "global"],
    queryFn: async () => {
      let q = (supabase
        .from("china_doc_alertas" as any)
        .select("*")
        .is("dispensado_em", null)
        .is("resolvido_em", null)
        .order("severidade", { ascending: false })
        .order("created_at", { ascending: false }) as any);
      if (submissaoId) q = q.eq("submissao_id", submissaoId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

export function useDispensarAlerta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (alertaId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase
        .from("china_doc_alertas" as any)
        .update({ dispensado_em: new Date().toISOString(), dispensado_por: user?.id })
        .eq("id", alertaId) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["china-doc-alertas"] }),
  });
}

export function useRecalcularAlertas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (submissaoId: string) => {
      const { error } = await (supabase.rpc as any)("rpc_recalcular_alertas_china", { _submissao_id: submissaoId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["china-doc-alertas"] }),
  });
}
