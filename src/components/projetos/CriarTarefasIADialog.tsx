import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Loader2, Calendar, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface AITask {
  titulo: string;
  descricao?: string;
  secao_id: string;
  prioridade: string;
  estagio?: string;
  data_prazo?: string;
  produto_mencionado?: string;
  selected?: boolean;
}

interface CriarTarefasIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secoes: { id: string; nome: string }[];
  projetoId: string;
  onCreateTasks: (tasks: AITask[]) => void;
  createTasksWithAI: (prompt: string, projetoId: string, secoes: { id: string; nome: string }[]) => Promise<{ tasks: AITask[] }>;
  loading: boolean;
}

const PRIORIDADE_COLORS: Record<string, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-amber-500/20 text-amber-400",
  alta: "bg-destructive/20 text-destructive",
};

export function CriarTarefasIADialog({
  open,
  onOpenChange,
  secoes,
  projetoId,
  onCreateTasks,
  createTasksWithAI,
  loading,
}: CriarTarefasIADialogProps) {
  const [prompt, setPrompt] = useState("");
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await createTasksWithAI(prompt, projetoId, secoes);
      setTasks(result.tasks.map(t => ({ ...t, selected: true })));
      setStep("review");
    } catch {
      // error handled in hook
    }
  };

  const handleConfirm = () => {
    const selected = tasks.filter(t => t.selected);
    if (selected.length === 0) return;
    onCreateTasks(selected);
    handleClose();
  };

  const handleClose = () => {
    setPrompt("");
    setTasks([]);
    setStep("input");
    onOpenChange(false);
  };

  const toggleTask = (index: number) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, selected: !t.selected } : t));
  };

  const getSecaoNome = (id: string) => secoes.find(s => s.id === id)?.nome || "—";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Criar Tarefas com IA
          </DialogTitle>
        </DialogHeader>

        {step === "input" ? (
          <div className="space-y-4 flex-1">
            <p className="text-sm text-muted-foreground">
              Descreva o que precisa ser feito em linguagem natural. A IA criará tarefas estruturadas automaticamente.
            </p>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder='Ex: "Precisamos criar rótulo, ficha técnica e arte final do Shampoo Revitalizante até dia 20. Prioridade alta para o rótulo."'
              className="min-h-[120px] resize-none"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Exemplos:</span>
              {[
                "Criar briefing e arte para novo produto",
                "Revisar documentação regulatória do lote 2025",
                "Preparar lançamento da linha premium",
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            <p className="text-sm text-muted-foreground">
              {tasks.length} tarefas geradas. Revise e selecione as que deseja criar:
            </p>
            {tasks.map((task, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                  task.selected ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-60"
                )}
              >
                <Checkbox
                  checked={task.selected}
                  onCheckedChange={() => toggleTask(i)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{task.titulo}</span>
                    <Badge variant="outline" className={cn("text-[10px]", PRIORIDADE_COLORS[task.prioridade])}>
                      <Flag className="h-3 w-3 mr-0.5" />
                      {task.prioridade}
                    </Badge>
                    {task.estagio && (
                      <Badge variant="outline" className="text-[10px]">
                        {task.estagio}
                      </Badge>
                    )}
                  </div>
                  {task.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>📁 {getSecaoNome(task.secao_id)}</span>
                    {task.data_prazo && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.data_prazo}
                      </span>
                    )}
                    {task.produto_mencionado && (
                      <span>📦 {task.produto_mencionado}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {step === "input" ? (
            <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar Tarefas
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("input")}>
                Voltar
              </Button>
              <Button onClick={handleConfirm} disabled={tasks.filter(t => t.selected).length === 0} className="gap-2">
                Criar {tasks.filter(t => t.selected).length} tarefa(s)
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
