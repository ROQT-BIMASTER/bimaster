import { useState } from "react";
import { Loader2, Send, FolderOpen, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useModulosDespachoResolved, type ModuloDespachoResolved } from "@/hooks/useModulosDespacho";
import { useProjetosParaVinculo, useSecoesETarefas } from "@/hooks/useChinaTarefaVinculos";

// Re-export for backward compatibility — now dynamic from DB
export function useDespachoModulos(): ModuloDespachoResolved[] {
  return useModulosDespachoResolved();
}

// Legacy constant kept as fallback — consumers should migrate to useDespachoModulos()
export const DESPACHO_MODULOS_PROCESSO: readonly { key: string; label: string; icon: LucideIcon; color: string }[] = [];

interface DespachoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoTitulo: string;
  isPending?: boolean;
  onDespachar: (modulo: string, descricao: string, vinculoProjeto?: { projeto_id: string; secao_id?: string; tarefa_id?: string }) => Promise<void>;
  /** Número do processo para exibir no registro */
  numeroProcesso?: string;
}

export function DespachoDialog({ open, onOpenChange, documentoTitulo, isPending, onDespachar, numeroProcesso }: DespachoDialogProps) {
  const modulos = useModulosDespachoResolved();
  const [modulo, setModulo] = useState<string>("");
  const [descricao, setDescricao] = useState("");

  // Project linking state
  const [vincularProjeto, setVincularProjeto] = useState(false);
  const [selectedProjeto, setSelectedProjeto] = useState("");
  const [selectedSecao, setSelectedSecao] = useState("");
  const [selectedTarefa, setSelectedTarefa] = useState("");

  const { data: projetos = [] } = useProjetosParaVinculo();
  const { data: secoesData } = useSecoesETarefas(selectedProjeto || null);

  const secoes = secoesData?.secoes || [];
  const tarefas = (secoesData?.tarefas || []).filter((t: any) =>
    !selectedSecao || t.secao_id === selectedSecao
  );

  // Set default when modulos load
  if (!modulo && modulos.length > 0) {
    setModulo(modulos[0].key);
  }

  const handleDespachar = async () => {
    const vinculo = vincularProjeto && selectedProjeto
      ? {
          projeto_id: selectedProjeto,
          secao_id: selectedSecao || undefined,
          tarefa_id: selectedTarefa || undefined,
        }
      : undefined;

    await onDespachar(modulo, descricao, vinculo);
    onOpenChange(false);
    setDescricao("");
    setVincularProjeto(false);
    setSelectedProjeto("");
    setSelectedSecao("");
    setSelectedTarefa("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Despachar para Módulo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{documentoTitulo}</span>
            {numeroProcesso && (
              <span className="ml-2 text-[10px] font-mono text-primary">Proc. {numeroProcesso}</span>
            )}
          </div>
          <div>
            <Label className="text-xs font-medium">Módulo de destino</Label>
            <RadioGroup value={modulo} onValueChange={setModulo} className="mt-2 space-y-2">
              {modulos.map((m) => {
                const ModIcon = m.icon;
                return (
                  <div key={m.key} className="flex items-center gap-2">
                    <RadioGroupItem value={m.key} id={`desp-proc-${m.key}`} />
                    <Label htmlFor={`desp-proc-${m.key}`} className="text-sm cursor-pointer flex items-center gap-2">
                      <ModIcon className={`h-4 w-4 ${m.color}`} /> {m.label}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-xs">Descrição do despacho</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que deve ser analisado..."
              rows={3}
            />
          </div>

          {/* Vincular ao Projeto */}
          <Collapsible open={vincularProjeto} onOpenChange={setVincularProjeto}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-2 text-xs h-8">
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                {vincularProjeto ? "Ocultar vínculo com projeto" : "Vincular tarefa no projeto"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3 border border-border rounded-lg p-3 bg-muted/20">
              <div className="space-y-1.5">
                <Label className="text-xs">Projeto</Label>
                <Select value={selectedProjeto} onValueChange={(v) => { setSelectedProjeto(v); setSelectedSecao(""); setSelectedTarefa(""); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecionar projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projetos.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProjeto && secoes.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Seção (opcional)</Label>
                  <Select value={selectedSecao} onValueChange={(v) => { setSelectedSecao(v); setSelectedTarefa(""); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar seção" />
                    </SelectTrigger>
                    <SelectContent>
                      {secoes.map((s: any) => (
                        <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedProjeto && tarefas.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarefa</Label>
                  <Select value={selectedTarefa} onValueChange={setSelectedTarefa}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecionar tarefa" />
                    </SelectTrigger>
                    <SelectContent>
                      {tarefas.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.codigo ? `${t.codigo} — ` : ""}{t.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                A movimentação e o número do processo serão registrados automaticamente na tarefa selecionada.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDespachar} disabled={isPending} className="gap-1.5">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
