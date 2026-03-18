import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCriarDespacho } from "@/hooks/useDespachoDocumentos";
import { useDocWorkflowConfigs } from "@/hooks/useDocWorkflow";

interface DespachoDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: any;
  submissaoId: string;
  processoId?: string;
  categoriaChecklist?: string;
}

export function DespachoDocumentoDialog({
  open,
  onOpenChange,
  documento,
  submissaoId,
  processoId,
  categoriaChecklist,
}: DespachoDocumentoDialogProps) {
  const [departamentoId, setDepartamentoId] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [observacao, setObservacao] = useState("");
  const criarDespacho = useCriarDespacho();
  const { configs: workflows } = useDocWorkflowConfigs();

  const { data: departamentos = [] } = useQuery({
    queryKey: ["departamentos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departamentos")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const handleDespachar = async () => {
    await criarDespacho.mutateAsync({
      submissao_id: submissaoId,
      documento_id: documento.id,
      processo_id: processoId,
      categoria_checklist: categoriaChecklist,
      departamento_destino_id: departamentoId || undefined,
      workflow_config_id: workflowId || undefined,
      observacao: observacao || undefined,
    });
    onOpenChange(false);
    setDepartamentoId("");
    setWorkflowId("");
    setObservacao("");
  };

  if (!documento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Despachar Documento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-xs space-y-1">
            <p className="font-medium text-foreground">{documento.nome_arquivo || documento.tipo_documento}</p>
            {categoriaChecklist && (
              <Badge variant="outline" className="text-[9px]">{categoriaChecklist}</Badge>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium">Departamento de destino</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o departamento..." />
              </SelectTrigger>
              <SelectContent>
                {departamentos.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium">Workflow documental (opcional)</Label>
            <Select value={workflowId} onValueChange={setWorkflowId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sem workflow específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum</SelectItem>
                {workflows.map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>{w.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Instruções para o departamento..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleDespachar} disabled={criarDespacho.isPending || !departamentoId} className="gap-1.5">
            {criarDespacho.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Despachar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
