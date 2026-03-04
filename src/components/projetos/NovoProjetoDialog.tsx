import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjetos } from "@/hooks/useProjetos";

const CORES = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];

interface NovoProjetoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoProjetoDialog({ open, onOpenChange }: NovoProjetoDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const { createProjeto } = useProjetos();

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    await createProjeto.mutateAsync({ nome: nome.trim(), descricao: descricao.trim() || undefined, cor });
    setNome("");
    setDescricao("");
    setCor(CORES[0]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do projeto</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Institucional | Ruby Rose" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Breve descrição do projeto" />
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex gap-2">
              {CORES.map(c => (
                <button
                  key={c}
                  onClick={() => setCor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: cor === c ? "white" : "transparent", transform: cor === c ? "scale(1.2)" : "scale(1)" }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || createProjeto.isPending}>
            {createProjeto.isPending ? "Criando..." : "Criar Projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
