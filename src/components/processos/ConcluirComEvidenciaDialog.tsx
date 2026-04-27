import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, FileText, Loader2, AlertCircle } from "lucide-react";
import {
  useDocsOficiaisEtapa,
  useConcluirEspelhoComEvidencia,
  type TarefaEspelho,
} from "@/hooks/useProcessoTarefaEspelho";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vínculo (espelho) que está sendo concluído */
  espelho: TarefaEspelho | null;
  /** Callback opcional após sucesso */
  onConcluido?: () => void;
}

/**
 * Diálogo obrigatório ao concluir uma tarefa do módulo Projetos que esteja
 * vinculada (espelhada) a uma etapa do processo.
 *
 * Regra: o usuário precisa selecionar QUAL documento oficial da etapa
 * comprova a conclusão. A seleção é registrada como evidência no processo
 * e o documento é marcado como entregue no checklist da etapa.
 */
export function ConcluirComEvidenciaDialog({ open, onOpenChange, espelho, onConcluido }: Props) {
  const [docId, setDocId] = useState<string>("");
  const [observacao, setObservacao] = useState("");

  const { data: documentos = [], isLoading } = useDocsOficiaisEtapa(
    espelho?.instancia_id,
    espelho?.etapa_id,
  );
  const concluir = useConcluirEspelhoComEvidencia();

  useEffect(() => {
    if (!open) {
      setDocId("");
      setObservacao("");
    }
  }, [open]);

  const handleConfirmar = async () => {
    if (!espelho || !docId) return;
    try {
      await concluir.mutateAsync({
        espelho_id: espelho.id,
        documento_id: docId,
        observacao: observacao.trim() || undefined,
      });
      onOpenChange(false);
      onConcluido?.();
    } catch {
      /* erro tratado no hook */
    }
  };

  const obrigatorios = documentos.filter((d) => d.obrigatorio);
  const opcionais = documentos.filter((d) => !d.obrigatorio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Concluir tarefa e registrar evidência
          </DialogTitle>
          <DialogDescription>
            Esta tarefa está vinculada a uma etapa do processo. Selecione o documento oficial
            que comprova a conclusão — ele será registrado como evidência e marcado como entregue
            na etapa.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : documentos.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
            <span>
              Esta etapa não tem documentos oficiais cadastrados. Cadastre ao menos um documento
              no perfil do processo antes de concluir esta tarefa.
            </span>
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            <RadioGroup value={docId} onValueChange={setDocId}>
              {obrigatorios.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Obrigatórios
                  </p>
                  {obrigatorios.map((d) => (
                    <DocOption key={d.id} doc={d} />
                  ))}
                </div>
              )}
              {opcionais.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Opcionais
                  </p>
                  {opcionais.map((d) => (
                    <DocOption key={d.id} doc={d} />
                  ))}
                </div>
              )}
            </RadioGroup>

            <div className="space-y-1.5 pt-2">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: revisão final aprovada por João em 27/04…"
                rows={2}
                className="text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!docId || concluir.isPending || documentos.length === 0}
            className="gap-1"
          >
            {concluir.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Concluir com evidência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocOption({
  doc,
}: {
  doc: { id: string; label: string; obrigatorio: boolean; entregue: boolean };
}) {
  return (
    <label
      htmlFor={`doc-${doc.id}`}
      className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-accent/40 transition-colors"
    >
      <RadioGroupItem id={`doc-${doc.id}`} value={doc.id} />
      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-sm flex-1">{doc.label}</span>
      {doc.entregue && (
        <Badge variant="secondary" className="text-[10px]">
          já entregue
        </Badge>
      )}
      {doc.obrigatorio && (
        <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">
          obrigatório
        </Badge>
      )}
    </label>
  );
}
