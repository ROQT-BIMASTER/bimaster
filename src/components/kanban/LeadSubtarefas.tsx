import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistItem {
  item: string;
  done: boolean;
}

interface Subtask {
  id: string;
  titulo: string;
  responsavel_id: string | null;
  checklist: ChecklistItem[];
  data_entrega: string | null;
  concluida: boolean;
  created_at: string;
}

interface LeadSubtarefasProps {
  prospectId: string;
}

export const LeadSubtarefas = ({ prospectId }: LeadSubtarefasProps) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSubtasks();
  }, [prospectId]);

  const fetchSubtasks = async () => {
    const { data, error } = await supabase
      .from("lead_subtasks")
      .select("*")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setSubtasks(data.map(d => ({
        ...d,
        checklist: (d.checklist as unknown as ChecklistItem[]) || [],
      })));
    }
    setLoading(false);
  };

  const addSubtask = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("lead_subtasks").insert({
      prospect_id: prospectId,
      titulo: newTitle.trim(),
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível criar subtarefa", variant: "destructive" });
    } else {
      setNewTitle("");
      fetchSubtasks();
    }
    setAdding(false);
  };

  const toggleSubtask = async (id: string, concluida: boolean) => {
    await supabase.from("lead_subtasks").update({ concluida: !concluida }).eq("id", id);
    fetchSubtasks();
  };

  const toggleChecklistItem = async (subtaskId: string, checklist: ChecklistItem[], idx: number) => {
    const updated = checklist.map((c, i) => i === idx ? { ...c, done: !c.done } : c);
    await supabase.from("lead_subtasks").update({ checklist: updated as unknown as any }).eq("id", subtaskId);
    fetchSubtasks();
  };

  const addChecklistItem = async (subtaskId: string, checklist: ChecklistItem[], itemText: string) => {
    if (!itemText.trim()) return;
    const updated = [...checklist, { item: itemText.trim(), done: false }];
    await supabase.from("lead_subtasks").update({ checklist: updated as unknown as any }).eq("id", subtaskId);
    fetchSubtasks();
  };

  const deleteSubtask = async (id: string) => {
    await supabase.from("lead_subtasks").delete().eq("id", id);
    fetchSubtasks();
  };

  const totalProgress = subtasks.length > 0
    ? Math.round((subtasks.filter(s => s.concluida).length / subtasks.length) * 100)
    : 0;

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Progresso Geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso Geral</span>
            <span className="text-sm font-bold text-primary">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {subtasks.filter(s => s.concluida).length} de {subtasks.length} tarefas concluídas
          </p>
        </CardContent>
      </Card>

      {/* Adicionar */}
      <div className="flex gap-2">
        <Input
          placeholder="Nova subtarefa..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubtask()}
        />
        <Button onClick={addSubtask} disabled={adding || !newTitle.trim()} size="sm">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {subtasks.map((task) => {
          const checklistProgress = task.checklist.length > 0
            ? Math.round((task.checklist.filter(c => c.done).length / task.checklist.length) * 100)
            : 0;

          return (
            <SubtaskCard
              key={task.id}
              task={task}
              checklistProgress={checklistProgress}
              onToggle={() => toggleSubtask(task.id, task.concluida)}
              onDelete={() => deleteSubtask(task.id)}
              onToggleItem={(idx) => toggleChecklistItem(task.id, task.checklist, idx)}
              onAddItem={(text) => addChecklistItem(task.id, task.checklist, text)}
            />
          );
        })}
        {subtasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma subtarefa criada ainda.
          </p>
        )}
      </div>
    </div>
  );
};

function SubtaskCard({ task, checklistProgress, onToggle, onDelete, onToggleItem, onAddItem }: {
  task: { id: string; titulo: string; concluida: boolean; checklist: ChecklistItem[]; data_entrega: string | null; created_at: string };
  checklistProgress: number;
  onToggle: () => void;
  onDelete: () => void;
  onToggleItem: (idx: number) => void;
  onAddItem: (text: string) => void;
}) {
  const [newItem, setNewItem] = useState("");

  return (
    <Card className={task.concluida ? "opacity-60" : ""}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <Checkbox checked={task.concluida} onCheckedChange={onToggle} className="mt-0.5" />
            <div>
              <p className={`text-sm font-medium ${task.concluida ? "line-through text-muted-foreground" : ""}`}>
                {task.titulo}
              </p>
              {task.data_entrega && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.data_entrega), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7">
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>

        {/* Sub-itens checklist */}
        {task.checklist.length > 0 && (
          <div className="ml-8 space-y-1.5">
            <Progress value={checklistProgress} className="h-1.5 mb-2" />
            {task.checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Checkbox checked={item.done} onCheckedChange={() => onToggleItem(idx)} className="h-3.5 w-3.5" />
                <span className={`text-xs ${item.done ? "line-through text-muted-foreground" : ""}`}>
                  {item.item}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Adicionar sub-item */}
        {!task.concluida && (
          <div className="ml-8 flex gap-2">
            <Input
              placeholder="Adicionar sub-item..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onAddItem(newItem);
                  setNewItem("");
                }
              }}
              className="h-7 text-xs"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
