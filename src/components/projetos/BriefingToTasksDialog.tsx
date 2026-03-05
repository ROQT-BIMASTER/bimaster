import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BriefingCampo } from "@/hooks/useProjetoBriefing";
import { Check, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const RESP_COLORS: Record<string, string> = {
  D: "bg-blue-500/20 text-blue-400",
  C: "bg-purple-500/20 text-purple-400",
  R: "bg-red-500/20 text-red-400",
  E: "bg-amber-500/20 text-amber-400",
  COMP: "bg-emerald-500/20 text-emerald-400",
};

interface BriefingToTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campos: BriefingCampo[];
  secoes: { id: string; nome: string }[];
  defaultSecaoId: string;
  onCreateTasks: (tasks: { titulo: string; descricao: string; prioridade: string; secao_id: string }[]) => void;
}

export function BriefingToTasksDialog({ open, onOpenChange, campos, secoes, defaultSecaoId, onCreateTasks }: BriefingToTasksDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(campos.map(c => c.id)));
  const [secaoId, setSecaoId] = useState(defaultSecaoId);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedCampos = campos.filter(c => selected.has(c.id));
    if (selectedCampos.length === 0) {
      toast.error("Selecione pelo menos um campo.");
      return;
    }

    const tasks = selectedCampos.map(c => ({
      titulo: `${c.campo}`,
      descricao: `[${c.categoria}] ${c.campo}: ${c.valor || "A definir"}`,
      prioridade: c.responsabilidade === "R" ? "alta" : "media",
      secao_id: secaoId,
    }));

    onCreateTasks(tasks);
    toast.success(`${tasks.length} tarefas criadas a partir do briefing!`);
    onOpenChange(false);
  };

  const grouped = campos.reduce<Record<string, BriefingCampo[]>>((acc, c) => {
    if (!acc[c.categoria]) acc[c.categoria] = [];
    acc[c.categoria].push(c);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Criar Tarefas a partir do Briefing
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Seção destino:</span>
          <Select value={secaoId} onValueChange={setSecaoId}>
            <SelectTrigger className="h-8 text-xs w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {secoes.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-xs">{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelected(new Set(campos.map(c => c.id)))}>
            Todas
          </Button>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelected(new Set())}>
            Nenhuma
          </Button>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh]">
          <div className="space-y-3 pr-2">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{cat}</h4>
                <div className="space-y-0.5">
                  {items.map(c => (
                    <div
                      key={c.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer",
                        selected.has(c.id) ? "border-primary/30 bg-primary/5" : "border-border/20 opacity-50"
                      )}
                      onClick={() => toggle(c.id)}
                    >
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.campo}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.valor || "—"}</p>
                      </div>
                      {c.responsabilidade && (
                        <Badge className={cn("text-[8px] border-0", RESP_COLORS[c.responsabilidade] || "bg-muted text-muted-foreground")}>
                          {c.responsabilidade}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0} className="gap-1.5">
            <Check className="h-4 w-4" />
            Criar {selected.size} tarefas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
