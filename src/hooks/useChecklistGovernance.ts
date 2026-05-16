/**
 * useChecklistGovernance
 * ------------------------------------------------------------------
 * Estado de governança por item do checklist China:
 *   - peso (%), prazo, obrigatoriedade
 *   - status (pendente | em_andamento | concluido | waiver)
 *   - ações: concluir, aplicar waiver, atualizar peso/prazo
 *   - progresso ponderado e gate de liberação para OC/OP
 *
 * Auto-seed: ao montar, garante uma linha em china_checklist_item_estado
 * para cada (fluxo, categoria, item) presente no checklist efetivo.
 * Pesos default são distribuídos igualmente quando ainda não há nenhum.
 */
import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMergedChinaChecklist } from "./useMergedChinaChecklist";
import { toast } from "sonner";

export interface ChecklistItemEstado {
  id: string;
  submissao_id: string;
  fluxo: "china_envia" | "brasil_envia" | "geral";
  categoria_key: string;
  item_key: string;
  peso_percentual: number;
  obrigatorio: boolean;
  prazo_data: string | null;
  responsavel_id: string | null;
  status: "pendente" | "em_andamento" | "concluido" | "waiver";
  concluido_em: string | null;
  concluido_por: string | null;
  waiver_motivo: string | null;
  waiver_aprovado_por: string | null;
  waiver_aprovado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressoChecklist {
  total_peso: number;
  peso_concluido: number;
  percent_concluido: number;
  peso_pendente_obrigatorio: number;
  itens_atrasados: number;
  itens_pendentes: number;
  total_itens: number;
  pode_liberar: boolean;
  liberado_para_oc_em: string | null;
}

export function useChecklistGovernance(submissaoId: string | null | undefined) {
  const enabled = !!submissaoId;
  const qc = useQueryClient();
  const merged = useMergedChinaChecklist(submissaoId);

  const estados = useQuery({
    queryKey: ["checklist-item-estado", submissaoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("china_checklist_item_estado")
        .select("*")
        .eq("submissao_id", submissaoId);
      if (error) throw error;
      return (data || []) as ChecklistItemEstado[];
    },
  });

  const progresso = useQuery({
    queryKey: ["checklist-progresso", submissaoId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "rpc_china_calcular_progresso",
        { p_submissao_id: submissaoId },
      );
      if (error) throw error;
      return data as ProgressoChecklist;
    },
  });

  // Auto-seed: insere linhas faltantes
  useEffect(() => {
    if (!enabled || merged.isLoading || estados.isLoading) return;
    if (!estados.data) return;

    const expected: { fluxo: string; categoria_key: string; item_key: string }[] = [];
    for (const cat of merged.categories) {
      for (const tipo of cat.tipos) {
        expected.push({
          fluxo: cat.fluxo,
          categoria_key: cat.isCustom ? `custom_${cat.customId}` : cat.key,
          item_key: tipo,
        });
      }
    }
    if (expected.length === 0) return;

    const expectedKeys = new Set(
      expected.map((e) => `${e.fluxo}|${e.categoria_key}|${e.item_key}`),
    );
    const existing = new Set(
      estados.data.map((e) => `${e.fluxo}|${e.categoria_key}|${e.item_key}`),
    );
    const missing = expected.filter(
      (e) => !existing.has(`${e.fluxo}|${e.categoria_key}|${e.item_key}`),
    );
    const orphanIds = estados.data
      .filter((e) => !expectedKeys.has(`${e.fluxo}|${e.categoria_key}|${e.item_key}`))
      .map((e) => e.id);

    if (missing.length === 0 && orphanIds.length === 0) return;

    // Distribuir peso para os novos: se já existia algum estado, novos vêm com 0
    // (usuário ajusta manualmente). Caso contrário, divide 100/N.
    const pesoDefault =
      estados.data.length === 0 ? Math.floor((100 / expected.length) * 100) / 100 : 0;

    (async () => {
      if (orphanIds.length > 0) {
        await (supabase as any)
          .from("china_checklist_item_estado")
          .delete()
          .in("id", orphanIds);
      }
      if (missing.length > 0) {
        await (supabase as any)
          .from("china_checklist_item_estado")
          .insert(
            missing.map((m) => ({
              submissao_id: submissaoId,
              fluxo: m.fluxo,
              categoria_key: m.categoria_key,
              item_key: m.item_key,
              peso_percentual: pesoDefault,
              obrigatorio: true,
              status: "pendente",
            })),
          );
      }
      qc.invalidateQueries({ queryKey: ["checklist-item-estado", submissaoId] });
      qc.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, merged.categories, estados.data, estados.isLoading, merged.isLoading]);

  const updateEstado = useMutation({
    mutationFn: async (
      patch: Partial<ChecklistItemEstado> & { id: string },
    ) => {
      const { id, ...rest } = patch;
      const { error } = await (supabase as any)
        .from("china_checklist_item_estado")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-item-estado", submissaoId] });
      qc.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao atualizar item"),
  });

  const concluirItem = useMutation({
    mutationFn: async (estadoId: string) => {
      const { error } = await (supabase as any).rpc("rpc_china_concluir_item", {
        p_estado_id: estadoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-item-estado", submissaoId] });
      qc.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] });
      toast.success("Item concluído");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao concluir"),
  });

  const aplicarWaiver = useMutation({
    mutationFn: async ({ estadoId, motivo }: { estadoId: string; motivo: string }) => {
      const { error } = await (supabase as any).rpc("rpc_china_aplicar_waiver", {
        p_estado_id: estadoId,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist-item-estado", submissaoId] });
      qc.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] });
      toast.success("Dispensa registrada");
    },
    onError: (e: any) => toast.error(e.message || "Falha ao aplicar dispensa"),
  });

  const liberarParaOC = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "rpc_china_liberar_para_oc",
        { p_submissao_id: submissaoId },
      );
      if (error) throw error;
      return data as { ok: boolean; erro?: string; progresso: ProgressoChecklist };
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Produto liberado para OC/OP");
        qc.invalidateQueries({ queryKey: ["checklist-progresso", submissaoId] });
      } else {
        toast.error(res.erro || "Não foi possível liberar");
      }
    },
    onError: (e: any) => toast.error(e.message || "Falha ao liberar"),
  });

  // Index para lookup rápido por (fluxo,categoria,item)
  const byKey = useMemo(() => {
    const m = new Map<string, ChecklistItemEstado>();
    (estados.data || []).forEach((e) =>
      m.set(`${e.fluxo}|${e.categoria_key}|${e.item_key}`, e),
    );
    return m;
  }, [estados.data]);

  return {
    estados: estados.data || [],
    isLoading: estados.isLoading || merged.isLoading,
    byKey,
    progresso: progresso.data,
    updateEstado,
    concluirItem,
    aplicarWaiver,
    liberarParaOC,
  };
}
