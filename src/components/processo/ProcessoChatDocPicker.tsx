import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, CheckCircle2, Stamp } from "lucide-react";

interface DocItem {
  id: string;
  titulo: string;
  categoria: string;
}

interface ProcessoChatDocPickerProps {
  open: boolean;
  onClose: () => void;
  documents: DocItem[];
  onVincular: (docIds: string[]) => void;
  onOficializar: (docId: string, titulo: string, fase: string) => void;
}

const FASES = [
  "Submissão Inicial",
  "Análise Regulatória",
  "Análise Composição",
  "Análise Design",
  "Análise Embalagem",
  "Aprovação Final",
  "Produção",
];

export function ProcessoChatDocPicker({ open, onClose, documents, onVincular, onOficializar }: ProcessoChatDocPickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"vincular" | "oficializar">("vincular");
  const [oficializarDoc, setOficializarDoc] = useState<DocItem | null>(null);
  const [fase, setFase] = useState(FASES[0]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirm = () => {
    if (mode === "vincular") {
      onVincular(selected);
    } else if (oficializarDoc) {
      onOficializar(oficializarDoc.id, oficializarDoc.titulo, fase);
    }
    setSelected([]);
    setOficializarDoc(null);
    setMode("vincular");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {mode === "vincular" ? "Vincular Documentos" : "Oficializar Documento"}
          </DialogTitle>
          <DialogDescription>
            {mode === "vincular"
              ? "Selecione documentos para vincular à mensagem"
              : "Tornar documento oficial do processo com juntada automática"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-2">
          <Button size="sm" variant={mode === "vincular" ? "default" : "outline"} onClick={() => setMode("vincular")} className="text-xs">
            <FileText className="h-3 w-3 mr-1" /> Vincular
          </Button>
          <Button size="sm" variant={mode === "oficializar" ? "default" : "outline"} onClick={() => setMode("oficializar")} className="text-xs">
            <Stamp className="h-3 w-3 mr-1" /> Oficializar
          </Button>
        </div>

        <ScrollArea className="h-[250px]">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento disponível</p>
          ) : (
            <div className="space-y-1">
              {documents.map(doc => {
                const isSelected = mode === "vincular"
                  ? selected.includes(doc.id)
                  : oficializarDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => {
                      if (mode === "vincular") toggle(doc.id);
                      else setOficializarDoc(isSelected ? null : doc);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-left transition-colors ${
                      isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    {isSelected ? (
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{doc.titulo}</span>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{doc.categoria}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {mode === "oficializar" && oficializarDoc && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">Fase do processo para juntada:</p>
            <Select value={fase} onValueChange={setFase}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FASES.map(f => (
                  <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={mode === "vincular" ? selected.length === 0 : !oficializarDoc}
          >
            {mode === "vincular" ? `Vincular (${selected.length})` : "Oficializar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
