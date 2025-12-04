import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  titulo: string;
  concluido: boolean;
  ordem: number;
}

interface TaskChecklistProps {
  tarefaId: string;
  items: ChecklistItem[];
}

export function TaskChecklist({ tarefaId, items }: TaskChecklistProps) {
  const [newItem, setNewItem] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const queryClient = useQueryClient();

  const addItem = useMutation({
    mutationFn: async (titulo: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('marketing_task_checklist')
        .insert({
          tarefa_id: tarefaId,
          titulo,
          ordem: items.length,
          created_by: user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
      setNewItem("");
      setIsAdding(false);
    },
    onError: () => toast.error('Erro ao adicionar item')
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('marketing_task_checklist')
        .update({
          concluido,
          concluido_em: concluido ? new Date().toISOString() : null,
          concluido_por: concluido ? user?.id : null
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
    },
    onError: () => toast.error('Erro ao atualizar item')
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_task_checklist')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-detail', tarefaId] });
    },
    onError: () => toast.error('Erro ao remover item')
  });

  const completedCount = items.filter(i => i.concluido).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleAddItem = () => {
    if (newItem.trim()) {
      addItem.mutate(newItem.trim());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Checklist de Entregáveis
        </h4>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{items.length} ({progress.toFixed(0)}%)
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items list */}
      <div className="space-y-1">
        {items.sort((a, b) => a.ordem - b.ordem).map(item => (
          <div 
            key={item.id}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg group",
              "hover:bg-muted/50 transition-colors"
            )}
          >
            <Checkbox
              checked={item.concluido}
              onCheckedChange={(checked) => 
                toggleItem.mutate({ id: item.id, concluido: !!checked })
              }
            />
            <span className={cn(
              "flex-1 text-sm",
              item.concluido && "line-through text-muted-foreground"
            )}>
              {item.titulo}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => deleteItem.mutate(item.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Novo item..."
            className="h-8 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            autoFocus
          />
          <Button 
            size="sm" 
            onClick={handleAddItem}
            disabled={addItem.isPending}
          >
            {addItem.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : 'Adicionar'}
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            onClick={() => { setIsAdding(false); setNewItem(""); }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar Item
        </Button>
      )}
    </div>
  );
}