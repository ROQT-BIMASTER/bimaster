import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface QuickAddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secoes: { id: string; nome: string }[];
  onAddTarefa: (titulo: string, secaoId: string) => void;
}

export function QuickAddTaskDialog({ open, onOpenChange, secoes, onAddTarefa }: QuickAddTaskDialogProps) {
  const [titulo, setTitulo] = useState("");
  const [secaoId, setSecaoId] = useState(secoes[0]?.id || "");

  const handleSubmit = () => {
    if (!titulo.trim() || !secaoId) return;
    onAddTarefa(titulo.trim(), secaoId);
    setTitulo("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs">Nome da tarefa</Label>
            <Input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Criar arte do rótulo..."
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Seção</Label>
            <Select value={secaoId} onValueChange={setSecaoId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione a seção" />
              </SelectTrigger>
              <SelectContent>
                {secoes.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!titulo.trim() || !secaoId}>Criar tarefa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
