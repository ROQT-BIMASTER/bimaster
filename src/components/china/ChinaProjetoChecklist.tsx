import { useChinaProjetoChecklist } from "@/hooks/useChinaProjeto";
import { BilingualLabel } from "./BilingualLabel";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const SECAO_CN: Record<string, string> = {
  "Criação / Identidade": "创作/标识",
  "Desenvolvimento de Produtos": "产品开发",
  "Desenvolvimento de Embalagem": "包装开发",
  "Informações dos Produtos (Briefing)": "产品信息（简报）",
  "Assuntos Regulatórios": "监管事务",
  "Criação / Artes": "创作/艺术",
};

interface ChinaProjetoChecklistProps {
  submissaoId: string;
}

export function ChinaProjetoChecklist({ submissaoId }: ChinaProjetoChecklistProps) {
  const { data: checklist = [], isLoading } = useChinaProjetoChecklist(submissaoId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card className="p-6">
        <BilingualLabel pt="Checklist Pré-Lançamento" cn="上市前检查清单" size="md" />
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (checklist.length === 0) return null;

  const totalTarefas = checklist.reduce((s, c) => s + c.total, 0);
  const totalConcluidas = checklist.reduce((s, c) => s + c.concluidas, 0);
  const pctGeral = totalTarefas > 0 ? Math.round((totalConcluidas / totalTarefas) * 100) : 0;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <BilingualLabel pt="Checklist Pré-Lançamento" cn="上市前检查清单" size="md" />
        <Badge variant={pctGeral === 100 ? "success" : "secondary"} className="text-xs">
          {totalConcluidas}/{totalTarefas} ({pctGeral}%)
        </Badge>
      </div>

      <Progress value={pctGeral} gradient className="h-2" />

      <div className="space-y-1">
        {checklist.map((sec) => {
          const isExpanded = expanded === sec.secao_id;
          const isDone = sec.total > 0 && sec.concluidas === sec.total;
          const pct = sec.total > 0 ? Math.round((sec.concluidas / sec.total) * 100) : 0;

          return (
            <div key={sec.secao_id}>
              <button
                onClick={() => setExpanded(isExpanded ? null : sec.secao_id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
                  "hover:bg-muted/50",
                  isDone && "opacity-80"
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm font-medium", isDone && "line-through text-muted-foreground")}>
                    {sec.secao_nome}
                  </span>
                  {SECAO_CN[sec.secao_nome] && (
                    <span className="text-[10px] text-muted-foreground ml-2">{SECAO_CN[sec.secao_nome]}</span>
                  )}
                </div>
                <Badge variant="ghost" className="text-[10px] shrink-0">
                  {sec.concluidas}/{sec.total}
                </Badge>
                {sec.tarefas.length > 0 && (
                  isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>

              {isExpanded && sec.tarefas.length > 0 && (
                <div className="ml-6 pl-4 border-l border-border/50 space-y-1 py-1">
                  {sec.tarefas.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 py-1 text-xs">
                      {t.status === "concluida" ? (
                        <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
                      )}
                      <span className={cn(
                        "flex-1",
                        t.status === "concluida" && "line-through text-muted-foreground"
                      )}>
                        {t.titulo}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
