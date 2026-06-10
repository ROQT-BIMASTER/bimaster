import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, Briefcase, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildReturnToTarget } from "@/lib/navigation/withReturnTo";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BriefingVersoesTimeline } from "@/components/briefings/BriefingVersoesTimeline";
import { RrTaskCofrePanel } from "@/components/rr-tasks/RrTaskCofrePanel";
import {
  wfTone,
  emGargalo,
  motivosGargalo,
  WF_FIELDS,
} from "@/lib/controladoria";
import type { RrTaskMirror } from "@/hooks/useRrTasksMirror";

function useProjetoSecaoLabels(projetoId: string | null, secaoId: string | null) {
  return useQuery({
    queryKey: ["rr-drilldown-projeto", projetoId, secaoId],
    enabled: !!projetoId,
    queryFn: async () => {
      const [proj, sec] = await Promise.all([
        supabase
          .from("projetos")
          .select("id, nome")
          .eq("id", projetoId!)
          .maybeSingle(),
        secaoId
          ? supabase
              .from("projeto_secoes")
              .select("id, nome")
              .eq("id", secaoId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
      ]);
      return {
        projetoNome: (proj.data as any)?.nome ?? null,
        secaoNome: (sec.data as any)?.nome ?? null,
      };
    },
  });
}

interface Props {
  task: RrTaskMirror | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function aprovacaoVariant(v: string | null) {
  switch (v) {
    case "Aprovado":
      return "success" as const;
    case "Devolvido":
      return "destructive" as const;
    case "Pendente":
      return "warning" as const;
    default:
      return "ghost" as const;
  }
}

const toneClass: Record<string, string> = {
  done: "bg-success",
  prog: "bg-primary",
  block: "bg-destructive",
  idle: "bg-muted",
};

export function RrTaskDrilldownSheet({ task, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { data: projetoLabels } = useProjetoSecaoLabels(
    task?.projeto_id ?? null,
    task?.secao_id ?? null,
  );
  if (!task) return null;

  const goToTarefa = () => {
    if (!task.projeto_id) return;
    const { url, state } = buildReturnToTarget(
      `/dashboard/projetos/${task.projeto_id}?tarefa=${task.id}`,
      "/dashboard/rr-tasks",
      { fromLabel: "RR-Tasks (espelho)" },
    );
    navigate(url, { state });
  };

  const goToProjeto = () => {
    if (!task.projeto_id) return;
    const { url, state } = buildReturnToTarget(
      `/dashboard/projetos/${task.projeto_id}`,
      "/dashboard/rr-tasks",
      { fromLabel: "RR-Tasks (espelho)" },
    );
    navigate(url, { state });
  };

  const goToBriefingCofre = () => {
    if (!task.briefing_id) return;
    const { url, state } = buildReturnToTarget(
      `/dashboard/briefings/${task.briefing_id}?tab=cofre`,
      "/dashboard/rr-tasks",
      { fromLabel: "RR-Tasks (espelho)" },
    );
    navigate(url, { state });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{task.titulo ?? "Sem título"}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="outline">{task.status ?? "—"}</Badge>
            {task.estagio && <Badge variant="ghost">{task.estagio}</Badge>}
            {task.rrtask_round != null && (
              <Badge variant="secondary">Round {task.rrtask_round}</Badge>
            )}
            <Badge variant={aprovacaoVariant(task.rrtask_aprovacao)}>
              {task.rrtask_aprovacao ?? "—"}
            </Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex flex-wrap gap-2">
          {task.rrtask_page_url && (
            <Button
              size="sm"
              variant="outline"
              asChild
            >
              <a
                href={task.rrtask_page_url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir no Notion
              </a>
            </Button>
          )}
          {task.briefing_id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const { url, state } = buildReturnToTarget(
                  `/dashboard/briefings/${task.briefing_id}`,
                  "/dashboard/rr-tasks",
                  { fromLabel: "RR-Tasks (espelho)" },
                );
                navigate(url, { state });
              }}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Abrir briefing
            </Button>
          )}
        </div>

        {task.produto && (
          <>
            <Separator className="my-5" />
            <section>
              <h4 className="text-sm font-semibold mb-2">
                Gargalo do produto
                {task.produto.marca && (
                  <span className="text-muted-foreground font-normal">
                    {" · "}
                    {task.produto.marca}
                  </span>
                )}
              </h4>
              {emGargalo(task.produto) ? (
                <ul className="space-y-1 text-sm">
                  {motivosGargalo(task.produto).map((m) => (
                    <li key={m.label} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-destructive" />
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground">— {m.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sem bloqueios no workflow.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                {WF_FIELDS.map((f) => {
                  const v = task.produto?.wf?.[f] ?? null;
                  const tone = wfTone(v);
                  return (
                    <div
                      key={f}
                      className="flex items-center gap-1.5 rounded border border-border px-1.5 py-1"
                    >
                      <span className={`h-2 w-2 rounded-full ${toneClass[tone]}`} />
                      <span className="truncate">{f}</span>
                      <span className="ml-auto text-muted-foreground truncate">
                        {v ?? "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {task.briefing_id && (
          <>
            <Separator className="my-5" />
            <section>
              <h4 className="text-sm font-semibold mb-2">Timeline de rounds</h4>
              <BriefingVersoesTimeline briefingId={task.briefing_id} />
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
