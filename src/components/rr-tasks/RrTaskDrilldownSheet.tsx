import { ExternalLink, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import {
  wfTone,
  emGargalo,
  motivosGargalo,
  WF_FIELDS,
} from "@/lib/controladoria";
import type { RrTaskMirror } from "@/hooks/useRrTasksMirror";

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
  if (!task) return null;

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
              onClick={() =>
                navigate(`/dashboard/briefings/${task.briefing_id}`)
              }
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
