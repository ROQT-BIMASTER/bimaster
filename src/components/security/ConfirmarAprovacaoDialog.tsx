/**
 * ConfirmarAprovacaoDialog — homologação de decisão sobre documento.
 *
 * Exige senha do usuário (revalidada no servidor) e parecer.
 * A decisão fica registrada com autor, data/hora e método na trilha
 * `china_doc_aprovacoes_audit`.
 */
import { useState } from "react";
import { Check, Loader2, ShieldCheck, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDecisaoHomologada } from "@/hooks/useDecisaoDocumentoChina";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  decisao: "aprovado" | "rejeitado";
  documentoLabel?: string | null;
  tarefaId?: string | null;
  projetoId?: string | null;
  origem?: string;
  onDone?: () => void;
}

export function ConfirmarAprovacaoDialog({
  open,
  onOpenChange,
  documentoId,
  decisao,
  documentoLabel,
  tarefaId,
  projetoId,
  origem = "kanban",
  onDone,
}: Props) {
  const [senha, setSenha] = useState("");
  const [parecer, setParecer] = useState("");
  const mutation = useDecisaoHomologada();
  const aprovando = decisao === "aprovado";

  const parecerObrigatorio = !aprovando;
  const disabled =
    mutation.isPending || senha.trim().length < 6 || (parecerObrigatorio && parecer.trim().length < 10);

  async function submit() {
    await mutation.mutateAsync({
      documentoId,
      decisao,
      senha,
      parecer,
      tarefaId,
      projetoId,
      origem,
    });
    setSenha("");
    setParecer("");
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSenha("");
          setParecer("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {aprovando ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-rose-600" />
            )}
            {aprovando ? "Aprovar documento" : "Marcar como não aprovado"}
          </DialogTitle>
          <DialogDescription>
            {documentoLabel ? `${documentoLabel}. ` : ""}
            A decisão é homologada com seu usuário, data e hora, e reflete em todos
            os ambientes do fluxo do checklist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Parecer {parecerObrigatorio ? "*" : "(opcional)"}
            </Label>
            <Textarea
              value={parecer}
              onChange={(e) => setParecer(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder={
                aprovando
                  ? "Ex.: Documento conferido e conforme a especificação."
                  : "Descreva o motivo da reprovação (mínimo 10 caracteres)."
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Confirme sua senha *
            </Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha do seu usuário"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled) void submit();
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              A senha é validada no servidor apenas para homologar esta decisão.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={disabled}
            variant={aprovando ? "default" : "destructive"}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {aprovando ? "Confirmar aprovação" : "Confirmar reprovação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
