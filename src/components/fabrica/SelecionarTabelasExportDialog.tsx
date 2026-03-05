import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TabelaItem {
  id: string;
  nome: string;
  codigo: string;
}

interface SelecionarTabelasExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabelas: TabelaItem[];
  onConfirm: (tabelaIds: string[]) => void;
  title?: string;
  description?: string;
}

export function SelecionarTabelasExportDialog({
  open,
  onOpenChange,
  tabelas,
  onConfirm,
  title = "Selecionar Tabelas para Exportação",
  description = "Escolha quais tabelas deseja incluir na exportação.",
}: SelecionarTabelasExportDialogProps) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    new Set(tabelas.map((t) => t.id))
  );

  const toggleTabela = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selecionadas.size === tabelas.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(tabelas.map((t) => t.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selecionadas));
    onOpenChange(false);
  };

  // Reset selection when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelecionadas(new Set(tabelas.map((t) => t.id)));
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b">
            <Checkbox
              id="select-all"
              checked={selecionadas.size === tabelas.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
              Selecionar todas ({tabelas.length})
            </Label>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {tabelas.map((tabela) => (
                <div
                  key={tabela.id}
                  className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50"
                >
                  <Checkbox
                    id={`tabela-${tabela.id}`}
                    checked={selecionadas.has(tabela.id)}
                    onCheckedChange={() => toggleTabela(tabela.id)}
                  />
                  <Label
                    htmlFor={`tabela-${tabela.id}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {tabela.nome}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({tabela.codigo})
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={selecionadas.size === 0}>
            Exportar ({selecionadas.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
