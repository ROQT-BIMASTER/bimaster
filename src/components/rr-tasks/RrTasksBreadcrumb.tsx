import { useQuery } from "@tanstack/react-query";
import { ChevronRight, KanbanSquare, FileText, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";
import { cn } from "@/lib/utils";

interface Props {
  /** Id da projeto_tarefa que originou o deep-link (pode estar nulo). */
  tarefaId: string | null;
  className?: string;
}

interface Trail {
  briefingId: string | null;
  briefingTitulo: string | null;
  tarefaTitulo: string | null;
}

/**
 * Breadcrumb mostrado no topo de uma página que veio de `/dashboard/rr-tasks`
 * via "Abrir tarefa" do drilldown. Cada nível navega para o seu lugar:
 *  - RR-Tasks (espelho) → board
 *  - Briefing → página do briefing
 *  - Tarefa → texto atual (sem navegação)
 */
export function RrTasksBreadcrumb({ tarefaId, className }: Props) {
  const navigate = useNavigate();

  const { data } = useQuery<Trail>({
    queryKey: ["rr-breadcrumb", tarefaId],
    enabled: !!tarefaId,
    queryFn: async () => {
      const { data: t, error: e1 } = await supabase
        .from("projeto_tarefas")
        .select("id, titulo, rrtask_page_id")
        .eq("id", tarefaId!)
        .maybeSingle();
      if (e1) throw e1;
      const pageId = (t as any)?.rrtask_page_id as string | undefined;
      if (!pageId) {
        return {
          briefingId: null,
          briefingTitulo: null,
          tarefaTitulo: (t as any)?.titulo ?? null,
        };
      }
      const { data: b } = await supabase
        .from("briefings")
        .select("id, titulo, updated_at")
        .eq("rrtask_page_id", pageId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return {
        briefingId: (b as any)?.id ?? null,
        briefingTitulo: (b as any)?.titulo ?? null,
        tarefaTitulo: (t as any)?.titulo ?? null,
      };
    },
  });

  const goRoot = () => navigate("/dashboard/rr-tasks");
  const goBriefing = () => {
    if (!data?.briefingId) return;
    const { url, state } = buildReturnToTarget(
      `/dashboard/briefings/${data.briefingId}`,
      "/dashboard/rr-tasks",
      { fromLabel: "RR-Tasks (espelho)" },
    );
    navigate(url, { state });
  };

  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground min-w-0",
        className,
      )}
    >
      <button
        type="button"
        onClick={goRoot}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
      >
        <KanbanSquare className="h-3 w-3" />
        <span>RR-Tasks</span>
      </button>

      {(data?.briefingTitulo || data?.briefingId) && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <button
            type="button"
            onClick={goBriefing}
            disabled={!data?.briefingId}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground transition-colors max-w-[180px] disabled:opacity-50 disabled:cursor-not-allowed"
            title={data?.briefingTitulo ?? "Briefing"}
          >
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {data?.briefingTitulo ?? "Briefing"}
            </span>
          </button>
        </>
      )}

      {data?.tarefaTitulo && (
        <>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-foreground font-medium max-w-[220px]"
            title={data.tarefaTitulo}
          >
            <ListChecks className="h-3 w-3 shrink-0" />
            <span className="truncate">{data.tarefaTitulo}</span>
          </span>
        </>
      )}
    </nav>
  );
}
