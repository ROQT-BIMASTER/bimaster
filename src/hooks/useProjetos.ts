import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { toast } from "sonner";
import { TEMPLATES, type TemplateKey } from "@/components/projetos/NovoProjetoDialog";

export interface Projeto {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string;
  criador_id: string;
  status: string;
  visibilidade: string;
  created_at: string;
  updated_at: string;
  bg_cor?: string | null;
  tipo: string;
  departamento_id?: string | null;
  data_inicio?: string | null;
  data_fim_alvo?: string | null;
  regime_calendario?: "corridos" | "dias_uteis" | "uteis_com_sabado";
  usa_feriados?: boolean;
  uf_feriados?: string;
  prazo_padrao_tarefa?: number;
  alerta_antecipacao_dias?: number;
}

/** Fetch a single project (with deadline / calendar fields). */
export function useProjeto(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-single", projetoId],
    queryFn: async () => {
      if (!projetoId) return null;
      const { data, error } = await supabase
        .from("projetos")
        .select("*")
        .eq("id", projetoId)
        .maybeSingle();
      if (error) throw error;
      return data as Projeto | null;
    },
    enabled: !!projetoId,
    staleTime: 60_000,
  });
}

export interface ProjetoMembro {
  user_id: string;
  papel: string;
  nome: string | null;
  avatar_url: string | null;
}

export interface ProjetoMetrics {
  projeto_id: string;
  total_tarefas: number;
  concluidas: number;
  atrasadas: number;
}

export interface UseProjetosOptions {
  /**
   * Quando true, sempre restringe a lista aos projetos a que o usuário
   * (real ou impersonado) tem acesso — criador, membro ou departamento.
   * Útil em telas como /dashboard/projetos onde admins não devem ver
   * tudo por padrão.
   */
  restrictToAccessible?: boolean;
}

export function useProjetos(options: UseProjetosOptions = {}) {
  const { user } = useAuth();
  const { isImpersonating, impersonatedUser, impersonatedPermissions } = useImpersonation();
  const queryClient = useQueryClient();

  // When the real admin is impersonating a non-admin user, the database
  // RLS still uses the admin's auth.uid(), so the SELECT returns every
  // project. We then need to mirror the RLS rule client-side and only
  // surface the projects the impersonated user could actually see.
  // When `restrictToAccessible` is on, we apply the same client-side
  // filter for the real user too (regardless of admin status).
  const impersonationRestrictId =
    isImpersonating && impersonatedUser && !impersonatedPermissions?.isAdmin
      ? impersonatedUser.id
      : null;
  const restrictToUserId =
    impersonationRestrictId ??
    (options.restrictToAccessible && user ? user.id : null);

  const { data: projetosRaw = [], isLoading } = useQuery({
    queryKey: ["projetos", restrictToUserId, options.restrictToAccessible],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accessible_projetos" as any, {
        _target_user_id: restrictToUserId,
        _include_all: !options.restrictToAccessible,
      });
      if (error) throw error;
      return data as Projeto[];
    },
    enabled: !!user,
  });

  const projetos = useMemo(() => {
    return projetosRaw;
  }, [projetosRaw]);

  // Fetch task metrics per project using RPC (avoids 1000-row limit)
  const { data: projetoMetrics = [] } = useQuery({
    queryKey: ["projetos-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projeto_metrics" as any);
      if (error) throw error;
      return (data || []) as ProjetoMetrics[];
    },
    enabled: !!user,
  });

  // Fetch members per project using secure RPC
  const { data: projetoMembros = [] } = useQuery({
    queryKey: ["projetos-membros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projetos_member_avatars" as any);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        projeto_id: m.projeto_id,
        user_id: m.user_id,
        papel: "membro",
        profiles: { nome: m.nome, avatar_url: m.avatar_url },
      })) as Array<{
        projeto_id: string;
        user_id: string;
        papel: string;
        profiles: { nome: string | null; avatar_url: string | null } | null;
      }>;
    },
    enabled: !!user,
  });

  // Fetch task collaborators per project via single RPC (Fase 2 — substitui
  // o fan-out N+batches que antes carregava todas as tarefas + colaboradores
  // em loops paginados de 500). A RPC já filtra por projetos onde o usuário
  // é membro/criador (SECURITY DEFINER, anon revogado).
  const { data: projetoColaboradores = [] } = useQuery({
    queryKey: ["projetos-colaboradores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_projetos_collab_avatars");
      if (error) throw error;
      return (data || []) as Array<{
        projeto_id: string;
        user_id: string;
        nome: string | null;
        avatar_url: string | null;
      }>;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const createProjeto = useMutation({
    mutationFn: async (projeto: {
      nome: string;
      descricao?: string;
      cor?: string;
      icone?: string;
      template?: TemplateKey;
      modelo_id?: string;
      marca?: string;
      categoriaLinha?: string;
      origemProjeto?: string;
      departamento_ids?: string[];
      // Prazos & Metas
      regime_calendario?: "corridos" | "dias_uteis" | "uteis_com_sabado";
      usa_feriados?: boolean;
      uf_feriados?: string;
      data_inicio?: string;
      data_fim_alvo?: string;
      prazo_padrao_tarefa?: number;
      alerta_antecipacao_dias?: number;
      metas_iniciais?: Array<{
        titulo: string;
        tipo: "entrega" | "qualidade" | "prazo" | "custo" | "volume";
        valor_alvo: number;
        unidade?: string;
        data_alvo?: string;
        peso?: number;
      }>;
    }) => {
      if (!user) throw new Error("Não autenticado");

      const {
        template,
        modelo_id,
        marca,
        categoriaLinha,
        origemProjeto,
        departamento_ids,
        metas_iniciais,
        ...projetoData
      } = projeto as any;

      // Se um modelo customizado foi escolhido, lemos sua estrutura para usar depois
      let modeloEstrutura: any = null;
      if (modelo_id) {
        const { data: modelo, error: errMod } = await supabase
          .from("projeto_modelos" as any)
          .select("estrutura, vinculado_produto")
          .eq("id", modelo_id)
          .single();
        if (errMod) throw errMod;
        modeloEstrutura = (modelo as any)?.estrutura ?? { secoes: [] };
      }

      const tipo = template || "generico";

      // Seções iniciais do template do sistema (quando não houver modelo customizado)
      const secoesIniciais = !modeloEstrutura
        ? (TEMPLATES[tipo as TemplateKey]?.secoes ?? []).map((nome, i) => ({ nome, ordem: i }))
        : [];

      const payload: any = {
        ...projetoData,
        tipo,
        ...(marca ? { marca } : {}),
        ...(categoriaLinha ? { categoria_linha: categoriaLinha } : {}),
        ...(origemProjeto ? { origem_projeto: origemProjeto } : {}),
        departamento_ids: departamento_ids ?? [],
        secoes: secoesIniciais,
        metas_iniciais: metas_iniciais ?? [],
      };

      const { data, error } = await supabase.rpc("rpc_criar_projeto" as any, {
        _payload: payload,
      });
      if (error) {
        const msg = error.message || "";
        if (msg.includes("not_authenticated")) throw new Error("Sessão expirada. Faça login novamente.");
        if (msg.includes("user_not_active")) throw new Error("Seu usuário ainda não está ativo. Contate o administrador.");
        throw new Error(`[projeto] ${msg}`);
      }

      // ============= Materializar seções/tarefas =============
      if (modeloEstrutura && Array.isArray(modeloEstrutura.secoes) && modeloEstrutura.secoes.length > 0) {
        // Modelo customizado: cria seções e depois tarefas/subtarefas
        const secoesPayload = modeloEstrutura.secoes.map((s: any, i: number) => ({
          projeto_id: data.id,
          nome: s.nome,
          ordem: typeof s.ordem === "number" ? s.ordem : i,
        }));
        const { data: secoesCriadas, error: secErr } = await supabase
          .from("projeto_secoes")
          .insert(secoesPayload)
          .select("id, ordem, nome");
        if (secErr) throw secErr;

        // Map ordem -> id
        const secaoIdByOrdem = new Map<number, string>();
        (secoesCriadas || []).forEach((s: any) => secaoIdByOrdem.set(s.ordem, s.id));

        // Cria tarefas top-level
        const tarefasInsert: any[] = [];
        modeloEstrutura.secoes.forEach((s: any, i: number) => {
          const secaoId = secaoIdByOrdem.get(typeof s.ordem === "number" ? s.ordem : i);
          if (!secaoId) return;
          (s.tarefas || []).forEach((t: any, ti: number) => {
            tarefasInsert.push({
              projeto_id: data.id,
              secao_id: secaoId,
              titulo: t.titulo,
              descricao: t.descricao || null,
              prioridade: t.prioridade || null,
              ordem: ti,
              criador_id: user.id,
              status: "todo",
              _origem_idx: `${i}:${ti}`, // marker temporário
            });
          });
        });

        if (tarefasInsert.length > 0) {
          // Remove marker antes de inserir
          const cleanInsert = tarefasInsert.map(({ _origem_idx, ...rest }) => rest);
          const { data: tarefasCriadas, error: tarErr } = await supabase
            .from("projeto_tarefas")
            .insert(cleanInsert)
            .select("id, secao_id, titulo, ordem");
          if (tarErr) throw tarErr;

          // Cria subtarefas (parent_tarefa_id)
          const subInsert: any[] = [];
          modeloEstrutura.secoes.forEach((s: any, i: number) => {
            const secaoId = secaoIdByOrdem.get(typeof s.ordem === "number" ? s.ordem : i);
            if (!secaoId) return;
            (s.tarefas || []).forEach((t: any, ti: number) => {
              if (!t.subtarefas || t.subtarefas.length === 0) return;
              const parent = (tarefasCriadas || []).find(
                (x: any) => x.secao_id === secaoId && x.ordem === ti && x.titulo === t.titulo,
              );
              if (!parent) return;
              t.subtarefas.forEach((st: any, si: number) => {
                subInsert.push({
                  projeto_id: data.id,
                  secao_id: secaoId,
                  parent_tarefa_id: parent.id,
                  titulo: st.titulo,
                  ordem: si,
                  criador_id: user.id,
                  status: "todo",
                });
              });
            });
          });
          if (subInsert.length > 0) {
            const { error: subErr } = await supabase.from("projeto_tarefas").insert(subInsert);
            if (subErr) throw subErr;
          }
        }

        // Incrementa contador de uso (best-effort)
        try {
          const { data: m } = await supabase
            .from("projeto_modelos" as any)
            .select("uso_count")
            .eq("id", modelo_id)
            .single();
          await supabase
            .from("projeto_modelos" as any)
            .update({ uso_count: ((m as any)?.uso_count ?? 0) + 1 } as any)
            .eq("id", modelo_id);
        } catch { /* ignore */ }
      }
      // Seções do template do sistema e metas iniciais já foram criadas pela RPC rpc_criar_projeto.


      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-membros"] });
      toast.success("Projeto criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar projeto: " + err.message);
    },
  });

  // Soft delete: marca deleted_at; cron purga após 30 dias.
  // RLS de SELECT filtra deleted_at IS NULL para usuários comuns,
  // então o projeto some da listagem normal automaticamente.
  const deleteProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rpc_soft_delete_projeto" as any, {
        p_projeto_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-membros"] });
      queryClient.invalidateQueries({ queryKey: ["projetos-lixeira"] });
      toast.success("Projeto movido para a lixeira. Permanecerá por 30 dias.");
    },
    onError: (err: Error) => {
      toast.error("Não foi possível excluir o projeto: " + err.message);
    },
  });

  const finalizarProjeto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projetos")
        .update({ status: "finalizado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto finalizado!");
    },
  });

  /**
   * Atualiza as configurações de um projeto já existente (campos do diálogo
   * "Novo Projeto" que não são template/modelo nem metas iniciais).
   *
   * - Aplica `UPDATE` apenas nas chaves passadas em `patch`.
   * - Reconcilia `projeto_departamentos` quando `departamento_ids` é informado.
   * - Datas em string vazia devem ser convertidas para `null` antes de chamar.
   */
  const updateProjetoConfig = useMutation({
    mutationFn: async (input: {
      id: string;
      patch: {
        nome?: string;
        descricao?: string | null;
        cor?: string;
        marca?: string | null;
        categoria_linha?: string | null;
        origem_projeto?: string | null;
        regime_calendario?: "corridos" | "dias_uteis" | "uteis_com_sabado";
        usa_feriados?: boolean;
        uf_feriados?: string;
        data_inicio?: string | null;
        data_fim_alvo?: string | null;
        prazo_padrao_tarefa?: number;
        alerta_antecipacao_dias?: number;
      };
      departamento_ids?: string[];
    }) => {
      const { id, patch, departamento_ids } = input;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from("projetos")
          .update(patch as any)
          .eq("id", id);
        if (error) throw error;
      }

      if (departamento_ids) {
        const { data: atuais, error: errAtuais } = await supabase
          .from("projeto_departamentos")
          .select("departamento_id")
          .eq("projeto_id", id);
        if (errAtuais) throw errAtuais;

        const atuaisSet = new Set((atuais || []).map((r: any) => r.departamento_id));
        const novosSet = new Set(departamento_ids);

        const paraRemover = [...atuaisSet].filter((d) => !novosSet.has(d));
        const paraAdicionar = [...novosSet].filter((d) => !atuaisSet.has(d));

        if (paraRemover.length > 0) {
          const { error } = await supabase
            .from("projeto_departamentos")
            .delete()
            .eq("projeto_id", id)
            .in("departamento_id", paraRemover);
          if (error) throw error;
        }
        if (paraAdicionar.length > 0) {
          const { error } = await supabase
            .from("projeto_departamentos")
            .insert(
              paraAdicionar.map((dep) => ({
                projeto_id: id,
                departamento_id: dep,
              })) as any,
            );
          if (error) throw error;
        }
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["projeto-single", vars.id] });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
      queryClient.invalidateQueries({ queryKey: ["projeto-departamentos-vinculos"] });
      toast.success("Configurações do projeto atualizadas.");
    },
    onError: (err: Error) => {
      toast.error("Não foi possível atualizar o projeto: " + err.message);
    },
  });

  return {
    projetos,
    isLoading,
    createProjeto,
    updateProjetoConfig,
    deleteProjeto,
    finalizarProjeto,
    projetoMetrics,
    projetoMembros,
    projetoColaboradores,
  };
}
