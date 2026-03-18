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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCriarDespachoLote } from "@/hooks/useDespachoDocumentos";
import { useDocWorkflowConfigs } from "@/hooks/useDocWorkflow";
import { DESPACHO_MODULOS_PROCESSO } from "./DespachoDialog";
import { WorkflowEtapasConfigurator } from "./WorkflowEtapasConfigurator";
import { toast } from "sonner";
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
  const [modulos, setModulos] = useState<string[]>([DESPACHO_MODULOS_PROCESSO[0].key]);
  const [workflowId, setWorkflowId] = useState("none");
  const [observacao, setObservacao] = useState("");
  const [prazoHoras, setPrazoHoras] = useState(48);
  const [showNewWorkflow, setShowNewWorkflow] = useState(false);
  const [newWorkflowNome, setNewWorkflowNome] = useState("");
  const criarLote = useCriarDespachoLote();
  const { configs: workflows, addConfig } = useDocWorkflowConfigs();

  const toggleModulo = (key: string) => {
    setModulos((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter((m) => m !== key);
      }
      return [...prev, key];
    });
  };

  const handleDespachar = async () => {
    if (documentos.length === 0 || modulos.length === 0) return;

    for (const modulo of modulos) {
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
    }

    onOpenChange(false);
    setModulos([DESPACHO_MODULOS_PROCESSO[0].key]);
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

  const totalDespachos = documentos.length * modulos.length;

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
            {documentos.map((doc: any) => (
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
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium">Módulos de destino</Label>
              {modulos.length > 1 && (
                <Badge variant="secondary" className="text-[9px]">
                  {modulos.length} módulos selecionados
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DESPACHO_MODULOS_PROCESSO.map((m) => (
                <label
                  key={m.key}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5"
                >
                  <Checkbox
                    checked={modulos.includes(m.key)}
                    onCheckedChange={() => toggleModulo(m.key)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs flex items-center gap-1.5">
                    <span>{m.icon}</span> {m.label}
                  </span>
                </label>
              ))}
            </div>
            {modulos.length > 1 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                O mesmo fluxo será aplicado em todos os módulos selecionados.
                Serão criados {totalDespachos} despachos no total.
              </p>
            )}
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
          <Button
            onClick={handleDespachar}
            disabled={criarLote.isPending || modulos.length === 0}
            className="gap-1.5"
          >
            {criarLote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar {totalDespachos > 1 ? `(${totalDespachos})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
