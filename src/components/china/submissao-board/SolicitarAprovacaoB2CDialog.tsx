import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, Workflow } from "lucide-react";
import { useTemplatesAlcadas } from "@/hooks/useLoteAprovacao";
import { useCriarLoteAprovacaoB2C } from "@/hooks/useLoteAprovacaoB2C";

export interface B2CElegivelItem {
  /** tipo_key (chave do checklist Brasil → China) */
  tipo: string;
  label: string;
  arquivoNome: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  submissaoId: string;
  submissaoCodigo?: string;
  submissaoNome?: string;
  itensElegiveis: B2CElegivelItem[];
  preselectedTipos?: string[];
}

export function SolicitarAprovacaoB2CDialog({
  open, onOpenChange, submissaoId, submissaoCodigo, submissaoNome,
  itensElegiveis, preselectedTipos,
}: Props) {
  const { data: templates = [], isLoading: loadingTpl } = useTemplatesAlcadas();
  const criar = useCriarLoteAprovacaoB2C();
  const [configId, setConfigId] = useState<string>("");
  const [loteNome, setLoteNome] = useState<string>(
    submissaoCodigo ? `Aprovação interna · ${submissaoCodigo}` : "Aprovação interna B→C",
  );
  const [prazo, setPrazo] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelected(new Set(preselectedTipos ?? itensElegiveis.map((i) => i.tipo)));
    }
  }, [open, preselectedTipos, itensElegiveis]);

  const canSubmit = useMemo(
    () => !!configId && loteNome.trim().length > 0 && selected.size > 0 && !criar.isPending,
    [configId, loteNome, selected, criar.isPending],
  );

  const toggle = (tipo: string) => {
    const next = new Set(selected);
    if (next.has(tipo)) next.delete(tipo);
    else next.add(tipo);
    setSelected(next);
  };

  const handleConfirm = async () => {
    await criar.mutateAsync({
      submissaoId,
      configId,
      loteNome: loteNome.trim(),
      tipos: Array.from(selected),
      prazoLote: prazo || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!criar.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Workflow className="h-4 w-4 text-primary" /> Solicitar aprovação interna
          </DialogTitle>
          <DialogDescription className="text-xs">
            {submissaoCodigo} {submissaoNome ? `— ${submissaoNome}` : ""}. Os itens selecionados ficam
            travados em aprovação até o lote ser concluído.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Fluxo de aprovação</Label>
            <Select value={configId} onValueChange={setConfigId} disabled={loadingTpl}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={loadingTpl ? "Carregando..." : "Selecione um template"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.nome}
                  </SelectItem>
                ))}
                {!loadingTpl && templates.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhum template ativo. Cadastre em /admin/templates-alcadas.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Nome do lote</Label>
              <Input
                className="h-8 text-xs"
                value={loteNome}
                onChange={(e) => setLoteNome(e.target.value.slice(0, 120))}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Prazo (opcional)</Label>
              <Input
                type="date"
                className="h-8 text-xs"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">
              Itens ({selected.size}/{itensElegiveis.length})
            </Label>
            <ScrollArea className="h-48 rounded-md border border-border">
              <ul className="divide-y divide-border/40">
                {itensElegiveis.length === 0 && (
                  <li className="px-2 py-2 text-xs text-muted-foreground">
                    Nenhum item disponível para aprovação. Anexe um arquivo a um item Brasil → China primeiro.
                  </li>
                )}
                {itensElegiveis.map((it) => (
                  <li key={it.tipo} className="flex items-start gap-2 px-2 py-1.5">
                    <Checkbox
                      checked={selected.has(it.tipo)}
                      onCheckedChange={() => toggle(it.tipo)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{it.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {it.arquivoNome || "(sem arquivo anexado)"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={criar.isPending}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={handleConfirm}>
            {criar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Iniciar aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
