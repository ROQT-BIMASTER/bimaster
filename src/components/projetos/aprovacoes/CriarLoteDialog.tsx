import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";
import { useTemplatesAlcadas, useCriarLoteAprovacao } from "@/hooks/useLoteAprovacao";
import { useChinaDocsDaTarefa } from "@/hooks/useChinaDocsDaTarefa";

interface Props {
  tarefaId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CriarLoteDialog({ tarefaId, open, onOpenChange }: Props) {
  const { data: templates = [], isLoading: loadingTpl } = useTemplatesAlcadas();
  const { data: docs = [], isLoading: loadingDocs } = useChinaDocsDaTarefa(tarefaId);
  const criar = useCriarLoteAprovacao();

  const [loteNome, setLoteNome] = useState("");
  const [configId, setConfigId] = useState<string>("");
  const [politica, setPolitica] = useState<"continuar" | "reiniciar_etapa">("continuar");
  const [prazo, setPrazo] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const docsDisponiveis = useMemo(() => docs, [docs]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  async function handleSubmit() {
    if (!loteNome.trim() || !configId || selected.size === 0) return;
    await criar.mutateAsync({
      tarefaId,
      configId,
      loteNome: loteNome.trim(),
      documentoIds: Array.from(selected),
      prazoLote: prazo || null,
      politica,
    });
    setLoteNome("");
    setConfigId("");
    setPrazo("");
    setSelected(new Set());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo lote de aprovação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lote-nome">Nome do lote</Label>
            <Input
              id="lote-nome"
              placeholder="Ex.: Aprovação de artes — rev. 1"
              value={loteNome}
              onChange={(e) => setLoteNome(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template de alçadas</Label>
              <Select value={configId} onValueChange={setConfigId} disabled={loadingTpl}>
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
              <Label>Política de movimentação</Label>
              <Select value={politica} onValueChange={(v) => setPolitica(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuar">Continuar fluxo ao mover</SelectItem>
                  <SelectItem value="reiniciar_etapa">Reiniciar etapa ao mover</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prazo">Prazo do lote (opcional)</Label>
            <Input id="prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Documentos a incluir ({selected.size}/{docsDisponiveis.length})</Label>
            <ScrollArea className="h-48 rounded-md border border-border p-2">
              {loadingDocs && <p className="text-xs text-muted-foreground">Carregando…</p>}
              {!loadingDocs && docsDisponiveis.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum documento da China vinculado a esta tarefa. Vincule documentos primeiro em "Vincular China".
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
                    <span className="text-xs truncate flex-1">
                      {d.nome_arquivo || d.tipo_documento}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{d.tipo_documento}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!loteNome.trim() || !configId || selected.size === 0 || criar.isPending}
          >
            {criar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Criar lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
