import { toFriendlyPermissionMessage } from "@/lib/utils/permissionErrors";
/**
 * useAprovacaoDetalhe — carrega o contexto de uma aprovação a partir
 * do `referencia_id` do inbox_item (que aponta para
 * `fluxo_aprovacao_aprovadores.id`).
 *
 * Expõe instância, etapa atual, histórico de eventos e mutations
 * para aprovar/rejeitar/comentar inline na Caixa de Entrada.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AprovacaoEvento {
  id: string;
  etapa_nome: string | null;
  rodada: number | null;
  decisao: string | null;
  comentario: string | null;
  decidido_por: string | null;
  decidido_nome?: string | null;
  concluido_em: string | null;
  created_at: string;
}

export interface AprovacaoDetalhe {
  aprovador_id: string;
  instancia_id: string;
  etapa_id: string;
  etapa_nome: string | null;
  instancia_titulo: string | null;
  instancia_status: string | null;
  projeto_id: string | null;
  projeto_nome: string | null;
  tarefa_titulo: string | null;
  responsavel_atual_id: string | null;
  prazo_em: string | null;
  podeDecidir: boolean;
  eventos: AprovacaoEvento[];
}

async function loadDetalhe(aprovadorId: string): Promise<AprovacaoDetalhe | null> {
  const { data: ap, error: apErr } = await (supabase as any)
    .from("fluxo_aprovacao_aprovadores")
    .select("id, instancia_id, etapa_id, usuario_id, status")
    .eq("id", aprovadorId)
    .maybeSingle();
  if (apErr) throw apErr;
  if (!ap) return null;

  const [{ data: inst }, { data: etapa }, { data: eventos }, { data: { user } }] =
    await Promise.all([
      (supabase as any)
        .from("fluxo_aprovacao_instancias")
        .select("id, titulo, status, projeto_id, tarefa_id")
        .eq("id", ap.instancia_id)
        .maybeSingle(),
      (supabase as any)
        .from("fluxo_aprovacao_etapas")
        .select("id, nome, prazo_em")
        .eq("id", ap.etapa_id)
        .maybeSingle(),
      (supabase as any)
        .from("fluxo_aprovacao_etapa_eventos")
        .select("id, etapa_nome, rodada, decisao, comentario, decidido_por, concluido_em, created_at")
        .eq("instancia_id", ap.instancia_id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.auth.getUser(),
    ]);

  // Resolver nomes dos decisores
  const decidedByIds = Array.from(
    new Set((eventos || []).map((e: any) => e.decidido_por).filter(Boolean)),
  );
  let nomes: Record<string, string> = {};
  if (decidedByIds.length) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, nome")
      .in("id", decidedByIds);
    nomes = Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome]));
  }

  // Buscar projeto/tarefa para contexto
  let projeto_nome: string | null = null;
  let tarefa_titulo: string | null = null;
  if (inst?.projeto_id) {
    const { data: proj } = await (supabase as any)
      .from("projetos")
      .select("nome")
      .eq("id", inst.projeto_id)
      .maybeSingle();
    projeto_nome = proj?.nome ?? null;
  }
  if (inst?.tarefa_id) {
    const { data: tar } = await (supabase as any)
      .from("projeto_tarefas")
      .select("titulo")
      .eq("id", inst.tarefa_id)
      .maybeSingle();
    tarefa_titulo = tar?.titulo ?? null;
  }

  return {
    aprovador_id: ap.id,
    instancia_id: ap.instancia_id,
    etapa_id: ap.etapa_id,
    etapa_nome: etapa?.nome ?? null,
    instancia_titulo: inst?.titulo ?? null,
    instancia_status: inst?.status ?? null,
    projeto_id: inst?.projeto_id ?? null,
    projeto_nome,
    tarefa_titulo,
    responsavel_atual_id: ap.usuario_id,
    prazo_em: etapa?.prazo_em ?? null,
    podeDecidir: ap.status === "pendente" && ap.usuario_id === user?.id,
    eventos: ((eventos || []) as any[]).map((e) => ({
      ...e,
      decidido_nome: e.decidido_por ? nomes[e.decidido_por] ?? null : null,
    })),
  };
}

export function useAprovacaoDetalhe(aprovadorId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-aprovacao", aprovadorId],
    enabled: !!aprovadorId,
    staleTime: 30_000,
    queryFn: () => loadDetalhe(aprovadorId!),
  });

  const decidir = useMutation({
    mutationFn: async (args: { decisao: "aprovado" | "rejeitado"; comentario?: string }) => {
      const instId = query.data?.instancia_id;
      if (!instId) throw new Error("Aprovação não carregada");
      const { error } = await supabase.rpc("rpc_avancar_etapa_aprovacao" as any, {
        p_instancia_id: instId,
        p_decisao: args.decisao,
        p_comentario: args.comentario ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.decisao === "aprovado" ? "Aprovado" : "Rejeitado");
      qc.invalidateQueries({ queryKey: ["inbox-aprovacao"] });
      qc.invalidateQueries({ queryKey: ["inbox-items"] });
    },
    onError: (e: any) => toast.error(toFriendlyPermissionMessage(e, "Falha ao registrar decisão")),
  });

  return { ...query, decidir };
}
