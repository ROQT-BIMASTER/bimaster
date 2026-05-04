import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2 } from "lucide-react";
import { useTemplatesAlcadas } from "@/hooks/useLoteAprovacao";
import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";
import { useEnviarDocumentoAprovacao } from "@/hooks/useKanbanAprovacoes";

interface Props {
  tarefaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function EnviarParaAprovacaoDialog({ tarefaId, open, onOpenChange }: Props) {
  const { data: templates = [], isLoading: loadingTpl } = useTemplatesAlcadas();
  const { data: docs = [], isLoading: loadingDocs } = useChinaDocsDaTarefa(tarefaId);
  const enviar = useEnviarDocumentoAprovacao();

  const [pipelineId, setPipelineId] = useState("");
  const [prazo, setPrazo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const docsDisponiveis = useMemo(() => docs, [docs]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function handleSubmit() {
    if (!pipelineId || selected.size === 0) return;
    await enviar.mutateAsync({
      documentoIds: Array.from(selected),
      pipelineId,
      tarefaId,
      prazoEm: prazo ? new Date(prazo).toISOString() : undefined,
    });
    setPipelineId("");
    setPrazo("");
    setSelected(new Set());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Enviar documentos para aprovação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pipeline</Label>
              <Select value={pipelineId} onValueChange={setPipelineId} disabled={loadingTpl}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo (opcional)</Label>
              <Input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Documentos ({selected.size}/{docsDisponiveis.length})</Label>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              {loadingDocs && <p className="text-xs text-muted-foreground">Carregando…</p>}
              {!loadingDocs && docsDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum documento vinculado a esta tarefa. Vincule documentos primeiro.
                </p>
              )}
              <div className="space-y-1">
                {docsDisponiveis.map((d) => (
                  <label
                    key={d.documento_id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(d.documento_id)}
                      onCheckedChange={() => toggle(d.documento_id)}
                    />
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">{d.nome_arquivo || d.tipo_documento}</span>
                    <span className="text-[10px] text-muted-foreground">{d.tipo_documento}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
            <p className="text-[10px] text-muted-foreground">
              Cada documento vira um card individual no Kanban de Aprovações.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!pipelineId || selected.size === 0 || enviar.isPending}
          >
            {enviar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
