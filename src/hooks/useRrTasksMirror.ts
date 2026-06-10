import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery } from "@/hooks/useSupabaseQuery";

export interface RrTaskResponsavel {
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
}

export interface RrTaskGargalo {
  marca: string | null;
  wf: Record<string, string | null> | null;
  composicao_pt: boolean | null;
  anvisa: string | null;
}

export interface RrTaskMirror {
  id: string;
  titulo: string | null;
  status: string | null;
  estagio: string | null;
  data_prazo: string | null;
  rrtask_page_id: string;
  rr_produto_notion_id: string | null;
  created_at: string;
  // briefing-side
  briefing_id: string | null;
  rrtask_round: number | null;
  rrtask_aprovacao: string | null;
  rrtask_page_url: string | null;
  // joins
  responsaveis: RrTaskResponsavel[];
  produto: RrTaskGargalo | null;
}

const QUERY_KEY = ["rr_tasks_mirror"];

export function useRrTasksMirror() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("rr-tasks-mirror")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "briefings" },
        () => {
          qc.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projeto_tarefas" },
        () => {
          qc.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return useSupabaseQuery<RrTaskMirror[]>(
    QUERY_KEY,
    async () => {
      // 1) Tarefas espelho
      const { data: tasks, error } = await supabase
        .from("projeto_tarefas")
        .select(
          "id, titulo, status, estagio, data_prazo, rrtask_page_id, rr_produto_notion_id, created_at",
        )
        .not("rrtask_page_id", "is", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (tasks ?? []) as Array<{
        id: string;
        titulo: string | null;
        status: string | null;
        estagio: string | null;
        data_prazo: string | null;
        rrtask_page_id: string;
        rr_produto_notion_id: string | null;
        created_at: string;
      }>;

      if (rows.length === 0) return [];

      const taskIds = rows.map((r) => r.id);
      const pageIds = Array.from(new Set(rows.map((r) => r.rrtask_page_id)));
      const produtoIds = Array.from(
        new Set(
          rows
            .map((r) => r.rr_produto_notion_id)
            .filter((v): v is string => !!v),
        ),
      );

      // 2) Responsáveis + perfis
      const [respRes, brfRes, prodRes] = await Promise.all([
        supabase
          .from("projeto_tarefa_responsaveis")
          .select("tarefa_id, user_id")
          .in("tarefa_id", taskIds),
        supabase
          .from("briefings")
          .select(
            "id, rrtask_page_id, rrtask_round, rrtask_aprovacao, rrtask_page_url, updated_at",
          )
          .in("rrtask_page_id", pageIds)
          .order("updated_at", { ascending: false }),
        produtoIds.length
          ? supabase
              .from("rr_produtos")
              .select("notion_page_id, marca, wf, composicao_pt, anvisa")
              .in("notion_page_id", produtoIds)
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      if (respRes.error) throw respRes.error;
      if (brfRes.error) throw brfRes.error;
      if ("error" in prodRes && prodRes.error) throw prodRes.error;

      const userIds = Array.from(
        new Set((respRes.data ?? []).map((r: any) => r.user_id)),
      );
      const profRes = userIds.length
        ? await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .in("id", userIds)
        : { data: [] as Array<{ id: string; nome: string; avatar_url: string | null }>, error: null };
      if ((profRes as any).error) throw (profRes as any).error;

      const profileById = new Map<string, { nome: string | null; avatar_url: string | null }>();
      ((profRes as any).data ?? []).forEach((p: any) => {
        profileById.set(p.id, { nome: p.nome ?? null, avatar_url: p.avatar_url ?? null });
      });

      const respByTask = new Map<string, RrTaskResponsavel[]>();
      (respRes.data ?? []).forEach((r: any) => {
        const list = respByTask.get(r.tarefa_id) ?? [];
        const p = profileById.get(r.user_id);
        list.push({
          user_id: r.user_id,
          nome: p?.nome ?? null,
          avatar_url: p?.avatar_url ?? null,
        });
        respByTask.set(r.tarefa_id, list);
      });

      // Briefings já vêm ordenados por updated_at DESC; manter o primeiro
      // (mais recente) em caso de múltiplos briefings com o mesmo page_id.
      const briefingByPage = new Map<string, {
        id: string;
        rrtask_round: number | null;
        rrtask_aprovacao: string | null;
        rrtask_page_url: string | null;
      }>();
      (brfRes.data ?? []).forEach((b: any) => {
        if (b.rrtask_page_id && !briefingByPage.has(b.rrtask_page_id)) {
          briefingByPage.set(b.rrtask_page_id, {
            id: b.id,
            rrtask_round: b.rrtask_round ?? null,
            rrtask_aprovacao: b.rrtask_aprovacao ?? null,
            rrtask_page_url: b.rrtask_page_url ?? null,
          });
        }
      });

      const produtoByPage = new Map<string, RrTaskGargalo>();
      ((prodRes as any).data ?? []).forEach((p: any) => {
        produtoByPage.set(p.notion_page_id, {
          marca: p.marca ?? null,
          wf: (p.wf ?? null) as Record<string, string | null> | null,
          composicao_pt: p.composicao_pt ?? null,
          anvisa: p.anvisa ?? null,
        });
      });

      return rows.map((r) => {
        const b = briefingByPage.get(r.rrtask_page_id);
        return {
          ...r,
          briefing_id: b?.id ?? null,
          rrtask_round: b?.rrtask_round ?? null,
          rrtask_aprovacao: b?.rrtask_aprovacao ?? null,
          rrtask_page_url: b?.rrtask_page_url ?? null,
          responsaveis: respByTask.get(r.id) ?? [],
          produto: r.rr_produto_notion_id
            ? produtoByPage.get(r.rr_produto_notion_id) ?? null
            : null,
        } satisfies RrTaskMirror;
      });
    },
  );
}
