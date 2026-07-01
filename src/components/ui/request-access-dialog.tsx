import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useCriarSolicitacaoAcesso, type AccessRequestInput } from "@/hooks/useAccessRequests";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  resourceKind: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  defaultJustification?: string;
}

/**
 * Diálogo para solicitar acesso a um recurso que caiu no AccessDeniedNotice.
 * Registra em `public.access_requests` via RPC e notifica administradores.
 */
export function RequestAccessDialog({
  open,
  onOpenChange,
  resourceKind,
  resourceId,
  resourceLabel,
  defaultJustification = "",
}: Props) {
  const [justification, setJustification] = useState(defaultJustification);
  const criar = useCriarSolicitacaoAcesso();

  const submit = async () => {
    const j = justification.trim();
    if (j.length < 10) return;
    const input: AccessRequestInput = {
      resourceKind,
      resourceId,
      resourceLabel,
      justification: j,
    };
    try {
      await criar.mutateAsync(input);
      onOpenChange(false);
      setJustification("");
    } catch {
      /* toast já disparado no hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar acesso</DialogTitle>
          <DialogDescription>
            {resourceLabel
              ? `Peça acesso a: ${resourceLabel}`
              : "Descreva rapidamente para qual conteúdo você precisa de acesso."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="access-req-justification" className="text-xs">
            Justificativa (mínimo 10 caracteres)
          </Label>
          <Textarea
            id="access-req-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Preciso ver este documento para..."
            className="min-h-[100px] text-sm"
            maxLength={2000}
          />
          <p className="text-[10px] text-muted-foreground">
            Recurso: <span className="font-mono">{resourceKind}</span>
            {resourceId ? ` · ${resourceId}` : ""}
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={criar.isPending || justification.trim().length < 10}
          >
            {criar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
