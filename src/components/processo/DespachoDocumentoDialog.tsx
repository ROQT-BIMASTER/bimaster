import { useState } from "react";
import { Send, Loader2, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useCriarDespachoLote } from "@/hooks/useDespachoDocumentos";
import { useDocWorkflowConfigs } from "@/hooks/useDocWorkflow";
import { DESPACHO_MODULOS_PROCESSO } from "./DespachoDialog";
import { WorkflowEtapasConfigurator } from "./WorkflowEtapasConfigurator";

interface DespachoDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentos: any[];
  submissaoId: string;
  processoId?: string;
  categoriaChecklist?: string;
}

export function DespachoDocumentoDialog({
  open,
  onOpenChange,
  documentos,
  submissaoId,
  processoId,
  categoriaChecklist,
}: DespachoDocumentoDialogProps) {
  const [modulo, setModulo] = useState<string>(DESPACHO_MODULOS_PROCESSO[0].key);
  const [workflowId, setWorkflowId] = useState("none");
  const [observacao, setObservacao] = useState("");
  const [prazoHoras, setPrazoHoras] = useState(48);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWorkflowNome, setNewWorkflowNome] = useState("");
  const criarLote = useCriarDespachoLote();
  const { configs: workflows, addConfig } = useDocWorkflowConfigs();

  const handleDespachar = async () => {
    if (documentos.length === 0) return;
    await criarLote.mutateAsync({
      submissao_id: submissaoId,
      documento_ids: documentos.map((d: any) => d.id),
      processo_id: processoId,
      categorias_checklist: categoriaChecklist
        ? Object.fromEntries(documentos.map((d: any) => [d.id, categoriaChecklist]))
        : undefined,
      modulo_destino: modulo,
      workflow_config_id: workflowId !== "none" ? workflowId : undefined,
      observacao: observacao || undefined,
      prazo_ciencia_horas: prazoHoras,
    });
    onOpenChange(false);
    setModulo(DESPACHO_MODULOS_PROCESSO[0].key);
    setWorkflowId("none");
    setObservacao("");
    setPrazoHoras(48);
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflowNome.trim()) return;
    const result = await addConfig.mutateAsync({
      tipo_documento: categoriaChecklist || "geral",
      nome: newWorkflowNome.trim(),
    });
    if (result?.id) setWorkflowId(result.id);
    setNewWorkflowNome("");
    setShowNewWorkflow(false);
  };

  if (documentos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Despachar {documentos.length > 1 ? `${documentos.length} Documentos` : "Documento"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Documents being dispatched */}
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1 max-h-32 overflow-y-auto">
            {documentos.map((doc: any, i: number) => (
              <div key={doc.id} className="flex items-center gap-2">
                <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-foreground truncate">{doc.nome_arquivo || doc.tipo_documento}</span>
              </div>
            ))}
            {categoriaChecklist && (
              <Badge variant="outline" className="text-[9px] mt-1">{categoriaChecklist}</Badge>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Módulo de destino</Label>
            <RadioGroup value={modulo} onValueChange={setModulo} className="mt-2 grid grid-cols-2 gap-1.5">
              {DESPACHO_MODULOS_PROCESSO.map((m) => (
                <div key={m.key} className="flex items-center gap-2">
                  <RadioGroupItem value={m.key} id={`desp-doc-${m.key}`} />
                  <Label htmlFor={`desp-doc-${m.key}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                    <span>{m.icon}</span> {m.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Prazo para ciência */}
          <div>
            <Label className="text-xs font-medium">Prazo para ciência e recebimento</Label>
            <div className="flex items-center gap-2 mt-1">
              <Select value={String(prazoHoras)} onValueChange={(v) => setPrazoHoras(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">48 horas</SelectItem>
                  <SelectItem value="72">72 horas</SelectItem>
                  <SelectItem value="120">5 dias</SelectItem>
                  <SelectItem value="168">7 dias</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground">para dar ciência</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Workflow documental (opcional)</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 text-[10px] gap-1 text-primary"
                onClick={() => setShowNewWorkflow(!showNewWorkflow)}
              >
                <Plus className="h-3 w-3" />
                Novo fluxo
              </Button>
            </div>
            {showNewWorkflow && (
              <div className="flex gap-1.5 mt-1.5 mb-1.5">
                <Input
                  value={newWorkflowNome}
                  onChange={(e) => setNewWorkflowNome(e.target.value)}
                  placeholder="Nome do novo fluxo..."
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs shrink-0"
                  onClick={handleCreateWorkflow}
                  disabled={!newWorkflowNome.trim() || addConfig.isPending}
                >
                  {addConfig.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Criar"}
                </Button>
              </div>
            )}
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sem workflow específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {workflows.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {workflowId && workflowId !== "none" && (
              <div className="mt-2">
                <WorkflowEtapasConfigurator
                  configId={workflowId}
                  configNome={workflows.find((w: any) => w.id === workflowId)?.nome || ""}
                />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instruções para o módulo..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDespachar} disabled={criarLote.isPending} className="gap-1.5">
            {criarLote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar {documentos.length > 1 ? `(${documentos.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
