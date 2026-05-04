import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ModoVisaoKanban = "minhas" | "equipe" | "coordenacao" | "todas";

export type EscopoKanban =
  | { escopo: "pessoal"; userId: string | undefined; modoVisao?: ModoVisaoKanban }
  | { escopo: "projeto"; projetoId: string | undefined; secaoId?: string | null }
  | { escopo: "secao"; secaoId: string | undefined };

export interface KanbanItem {
  id: string;
  documento_id: string;
  pipeline_id: string;
  etapa_atual_id: string | null;
  responsavel_atual_id: string | null;
  status: string;
  lote_id: string | null;
  parent_item_id: string | null;
  projeto_id: string | null;
  secao_id: string | null;
  tarefa_id: string | null;
  prazo_em: string | null;
  comentario_atual: string | null;
  created_by: string | null;
  created_at: string;
  // joins
  documento_nome: string | null;
  documento_tipo: string | null;
  documento_path: string | null;
  documento_url: string | null;
  pipeline_nome: string | null;
  etapa_nome: string | null;
  etapa_ordem: number | null;
  etapa_tipo: string | null;
  responsavel_nome: string | null;
  projeto_nome: string | null;
  secao_nome: string | null;
  tarefa_titulo: string | null;
  lote_nome: string | null;
}

export interface KanbanEtapa {
  id: string;
  nome: string;
  ordem: number;
  tipo: string;
  pipeline_destino_id: string | null;
  responsavel_id: string | null;
}

export interface KanbanPipeline {
  id: string;
  nome: string;
  etapas: KanbanEtapa[];
}

interface KanbanData {
  itens: KanbanItem[];
  pipelines: KanbanPipeline[];
}

export function useKanbanAprovacoes(escopo: EscopoKanban) {
  return useQuery({
    queryKey: ["kanban-aprovacoes", escopo],
    queryFn: async (): Promise<KanbanData> => {
      let q = supabase
        .from("aprovacao_documento_itens")
        .select(`
          id, documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
          status, lote_id, parent_item_id, projeto_id, secao_id, tarefa_id,
          prazo_em, comentario_atual, created_by, created_at,
          china_produto_documentos(nome_arquivo, tipo_documento, arquivo_path, arquivo_url),
          fluxo_aprovacao_config!aprovacao_documento_itens_pipeline_id_fkey(nome),
          fluxo_aprovacao_etapas!aprovacao_documento_itens_etapa_atual_id_fkey(nome, ordem, tipo, pipeline_destino_id),
          projetos(nome),
          projeto_secoes(nome),
          projeto_tarefas(titulo),
          fluxo_aprovacao_instancias(lote_nome)
        `)
        .order("created_at", { ascending: false });

      if (escopo.escopo === "pessoal") {
        if (!escopo.userId) return { itens: [], pipelines: [] };
        const modo = escopo.modoVisao ?? "minhas";
        if (modo === "minhas") {
          q = q.eq("responsavel_atual_id", escopo.userId).eq("status", "em_andamento");
        } else if (modo === "equipe") {
          // RLS já restringe a projetos onde sou membro; trazemos todos em_andamento
          q = q.eq("status", "em_andamento");
        } else if (modo === "coordenacao") {
          // Apenas projetos onde sou coordenador/owner ou criei
          const { data: pms } = await supabase
            .from("projeto_membros")
            .select("projeto_id, papel")
            .eq("user_id", escopo.userId)
            .in("papel", ["coordenador", "owner", "lider"]);
          const ids = (pms || []).map((p: any) => p.projeto_id);
          if (ids.length === 0) return { itens: [], pipelines: [] };
          q = q.in("projeto_id", ids).eq("status", "em_andamento");
        } else if (modo === "todas") {
          q = q.eq("status", "em_andamento");
        }
      } else if (escopo.escopo === "projeto") {
        if (!escopo.projetoId) return { itens: [], pipelines: [] };
        q = q.eq("projeto_id", escopo.projetoId);
        if (escopo.secaoId) q = q.eq("secao_id", escopo.secaoId);
      } else if (escopo.escopo === "secao") {
        if (!escopo.secaoId) return { itens: [], pipelines: [] };
        q = q.eq("secao_id", escopo.secaoId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const itens: KanbanItem[] = ((data || []) as any[]).map((r) => ({
        id: r.id,
        documento_id: r.documento_id,
        pipeline_id: r.pipeline_id,
        etapa_atual_id: r.etapa_atual_id,
        responsavel_atual_id: r.responsavel_atual_id,
        status: r.status,
        lote_id: r.lote_id,
        parent_item_id: r.parent_item_id,
        projeto_id: r.projeto_id,
        secao_id: r.secao_id,
        tarefa_id: r.tarefa_id,
        prazo_em: r.prazo_em,
        comentario_atual: r.comentario_atual,
        created_by: r.created_by,
        created_at: r.created_at,
        documento_nome: r.china_produto_documentos?.nome_arquivo ?? null,
        documento_tipo: r.china_produto_documentos?.tipo_documento ?? null,
        documento_path: r.china_produto_documentos?.arquivo_path ?? null,
        documento_url: r.china_produto_documentos?.arquivo_url ?? null,
        pipeline_nome: r.fluxo_aprovacao_config?.nome ?? null,
        etapa_nome: r.fluxo_aprovacao_etapas?.nome ?? null,
        etapa_ordem: r.fluxo_aprovacao_etapas?.ordem ?? null,
        etapa_tipo: r.fluxo_aprovacao_etapas?.tipo ?? null,
        responsavel_nome: null,
        projeto_nome: r.projetos?.nome ?? null,
        secao_nome: r.projeto_secoes?.nome ?? null,
        tarefa_titulo: r.projeto_tarefas?.titulo ?? null,
        lote_nome: r.fluxo_aprovacao_instancias?.lote_nome ?? null,
      }));

      // resolve nomes responsáveis
      const userIds = Array.from(new Set(itens.map((i) => i.responsavel_atual_id).filter(Boolean))) as string[];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", userIds);
        const map = new Map((profs || []).map((p: any) => [p.id, p.nome]));
        itens.forEach((i) => {
          if (i.responsavel_atual_id) i.responsavel_nome = map.get(i.responsavel_atual_id) ?? null;
        });
      }

      // pipelines envolvidos (para definir colunas) — quando vazio, busca todos ativos
      let pipelineIds = Array.from(new Set(itens.map((i) => i.pipeline_id)));
      let pipelines: KanbanPipeline[] = [];

      if (pipelineIds.length === 0) {
        // sempre mostrar colunas: pega todos pipelines ativos
        const { data: cfgAll } = await supabase
          .from("fluxo_aprovacao_config")
          .select("id, nome, ativo")
          .eq("ativo", true);
        pipelineIds = (cfgAll || []).map((c: any) => c.id);
      }

      if (pipelineIds.length > 0) {
        const { data: cfg } = await supabase
          .from("fluxo_aprovacao_config")
          .select("id, nome")
          .in("id", pipelineIds);
        const { data: et } = await supabase
          .from("fluxo_aprovacao_etapas")
          .select("id, config_id, nome, ordem, tipo, pipeline_destino_id, responsavel_id")
          .in("config_id", pipelineIds)
          .eq("ativo", true)
          .order("ordem");
        pipelines = (cfg || []).map((c: any) => ({
          id: c.id,
          nome: c.nome,
          etapas: ((et || []) as any[])
            .filter((e) => e.config_id === c.id)
            .map((e) => ({
              id: e.id,
              nome: e.nome,
              ordem: e.ordem,
              tipo: e.tipo,
              pipeline_destino_id: e.pipeline_destino_id,
              responsavel_id: e.responsavel_id,
            })),
        }));
      }

      return { itens, pipelines };
    },
    enabled:
      (escopo.escopo === "pessoal" && !!escopo.userId) ||
      (escopo.escopo === "projeto" && !!escopo.projetoId) ||
      (escopo.escopo === "secao" && !!escopo.secaoId),
  });
}

export function useAvancarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; decisao: "aprovado" | "rejeitado" | "encaminhado"; comentario?: string }) => {
      const { data, error } = await supabase.rpc("rpc_avancar_item_aprovacao", {
        p_item_id: input.itemId,
        p_decisao: input.decisao,
        p_comentario: input.comentario,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      const labels: Record<string, string> = { aprovado: "Aprovado", rejeitado: "Rejeitado", encaminhado: "Encaminhado" };
      toast.success(labels[vars.decisao]);
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha"),
  });
}

export function useMoverItemKanban() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; etapaDestinoId: string }) => {
      const { error } = await supabase.rpc("rpc_mover_item_kanban", {
        p_item_id: input.itemId,
        p_etapa_destino_id: input.etapaDestinoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao mover"),
  });
}

export type ColunaUniversal = "em_analise" | "em_revisao" | "aprovado" | "rejeitado" | "aguardando_outros";

export function useMoverItemColuna() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      coluna: ColunaUniversal;
      comentario?: string;
    }) => {
      const { error } = await supabase.rpc("rpc_mover_item_coluna" as any, {
        p_item_id: input.itemId,
        p_coluna: input.coluna,
        p_comentario: input.comentario ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      const labels: Record<string, string> = {
        aprovado: "Aprovado",
        rejeitado: "Rejeitado",
        em_revisao: "Devolvido para revisão",
      };
      toast.success(labels[vars.coluna] || "Movido");
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao mover"),
  });
}

export function useSolicitarRevisao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; comentario?: string }) => {
      const { error } = await supabase.rpc("rpc_solicitar_revisao_item" as any, {
        p_item_id: input.itemId,
        p_comentario: input.comentario ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devolvido para revisão");
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha"),
  });
}

export function useEnviarDocumentoAprovacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      documentoIds: string[];
      pipelineId: string;
      tarefaId?: string;
      loteId?: string;
      prazoEm?: string;
      overrides?: Record<string, string>; // { etapa_id: user_id }
    }) => {
      const ids: string[] = [];
      for (const docId of input.documentoIds) {
        const { data, error } = await supabase.rpc("rpc_enviar_documento_aprovacao", {
          p_documento_id: docId,
          p_pipeline_id: input.pipelineId,
          p_tarefa_id: input.tarefaId,
          p_lote_id: input.loteId,
          p_prazo_em: input.prazoEm,
          p_overrides: input.overrides as any,
        } as any);
        if (error) throw error;
        ids.push(data as string);
      }
      return ids;
    },
    onSuccess: (ids) => {
      toast.success(`${ids.length} documento(s) enviado(s) para aprovação`);
      qc.invalidateQueries({ queryKey: ["kanban-aprovacoes"] });
      qc.invalidateQueries({ queryKey: ["lotes-aprovacao"] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar"),
  });
}
