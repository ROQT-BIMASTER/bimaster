import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { OffboardingPayload } from "@/lib/validations/projetoOffboarding";

export interface ExMembroProjeto {
  id: string;
  projeto_id: string;
  user_id_removido: string;
  papel_anterior: string;
  secoes_ids_anteriores: string[];
  motivo: string;
  motivo_detalhe: string | null;
  removido_por: string;
  removido_em: string;
  restaurado_em: string | null;
  restaurado_por: string | null;
  profile?: { id: string; nome: string | null; avatar_url: string | null } | null;
  removedor_profile?: { id: string; nome: string | null } | null;
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: "Você não tem permissão para gerenciar membros deste projeto.",
  ultimo_coordenador: "Este é o último coordenador do projeto. Promova outro membro antes de remover.",
  novo_responsavel_nao_e_membro: "O novo responsável precisa ser membro deste projeto.",
  novo_seguidor_nao_e_membro: "O novo seguidor precisa ser membro deste projeto.",
  membro_nao_encontrado: "Membro não encontrado (já pode ter sido removido).",
  invalid_motivo: "Motivo inválido.",
  audit_nao_encontrado: "Registro de remoção não encontrado.",
  ja_restaurado: "Este ex-membro já foi restaurado.",
  prazo_expirado: "Prazo de 15 dias para restauração já expirou.",
};

function traduzirErro(msg: string | undefined): string {
  if (!msg) return "Falha ao processar.";
  for (const key of Object.keys(ERROR_MESSAGES)) {
    if (msg.includes(key)) return ERROR_MESSAGES[key];
  }
  return msg;
}

export function useProjetoOffboarding(projetoId: string | undefined) {
  const qc = useQueryClient();

  const exMembros = useQuery({
    queryKey: ["projeto_ex_membros", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];
      const { data, error } = await supabase
        .from("projeto_membros_audit" as any)
        .select("*")
        .eq("projeto_id", projetoId)
        .is("restaurado_em", null)
        .gte("removido_em", new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString())
        .order("removido_em", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      if (rows.length === 0) return [] as ExMembroProjeto[];

      const userIds = Array.from(
        new Set([
          ...rows.map((r) => r.user_id_removido),
          ...rows.map((r) => r.removido_por),
        ]),
      );
      const { data: profiles } = await supabase
        .rpc("get_projeto_membros_directory" as any, { _projeto_id: projetoId });
      const profMap = new Map<string, { id: string; nome: string | null; avatar_url: string | null }>(
        ((profiles as any[]) || []).map((p) => [p.id, p]),
      );
      return rows.map((r) => ({
        ...r,
        profile: profMap.get(r.user_id_removido) ?? null,
        removedor_profile: profMap.get(r.removido_por) ?? null,
      })) as ExMembroProjeto[];
    },
    enabled: !!projetoId,
    staleTime: 30 * 1000,
  });

  const remover = useMutation({
    mutationFn: async (payload: OffboardingPayload) => {
      const { data, error } = await (supabase.rpc as any)("rpc_remover_membro_projeto", {
        _membro_id: payload.membroId,
        _reatribuicoes: {
          tarefas_responsavel: payload.novoResponsavelTarefas,
          seguidores: payload.novoSeguidor,
        },
        _motivo: payload.motivo,
        _motivo_detalhe: payload.motivoDetalhe ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Membro removido com reatribuição registrada.");
      qc.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto_ex_membros", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto-tarefas-v2", projetoId] });
      qc.invalidateQueries({ queryKey: ["projetos-membros"] });
      qc.invalidateQueries({ queryKey: ["projetos-team-data"] });
    },
    onError: (err: Error) => {
      toast.error(traduzirErro(err.message));
    },
  });

  const restaurar = useMutation({
    mutationFn: async (auditId: string) => {
      const { data, error } = await (supabase.rpc as any)("rpc_restaurar_membro_projeto", {
        _audit_id: auditId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Acesso restaurado.");
      qc.invalidateQueries({ queryKey: ["projeto_membros", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto_ex_membros", projetoId] });
      qc.invalidateQueries({ queryKey: ["projetos-membros"] });
      qc.invalidateQueries({ queryKey: ["projetos-team-data"] });
    },
    onError: (err: Error) => {
      toast.error(traduzirErro(err.message));
    },
  });

  return { exMembros, remover, restaurar };
}
