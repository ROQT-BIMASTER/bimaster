/**
 * ReabrirDocumentoDialog — reabertura de documento já homologado.
 *
 * Exige motivo e confirmação de senha (validada no servidor) e grava um
 * registro próprio, separado, na trilha de homologação. A decisão anterior
 * permanece preservada para auditoria.
 */
import { useState } from "react";
import { Loader2, RotateCcw, ShieldCheck } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReabrirDocumento } from "@/hooks/useDecisaoDocumentoChina";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentoId: string;
  documentoLabel?: string | null;
  statusAtual?: string | null;
  tarefaId?: string | null;
  projetoId?: string | null;
  origem?: string;
  onDone?: () => void;
}

export function ReabrirDocumentoDialog({
  open,
  onOpenChange,
  documentoId,
  documentoLabel,
  statusAtual,
  tarefaId,
  projetoId,
  origem = "tarefa",
  onDone,
}: Props) {
  const [senha, setSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novoStatus, setNovoStatus] = useState<"em_analise" | "pendente">("em_analise");
  const mutation = useReabrirDocumento();

  const disabled =
    mutation.isPending || senha.trim().length < 6 || motivo.trim().length < 10;

  function limpar() {
    setSenha("");
    setMotivo("");
    setNovoStatus("em_analise");
  }

  async function submit() {
    await mutation.mutateAsync({
      documentoId,
      senha,
      motivo,
      novoStatus,
      tarefaId,
      projetoId,
      origem,
    });
    limpar();
    onOpenChange(false);
    onDone?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) limpar();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Reabrir para nova análise
          </DialogTitle>
          <DialogDescription>
            {documentoLabel ? `${documentoLabel}. ` : ""}
            {statusAtual === "rejeitado"
              ? "O documento está como não aprovado. "
              : statusAtual === "aprovado"
                ? "O documento está aprovado. "
                : ""}
            A reabertura não apaga a decisão anterior: um novo registro homologado
            é criado com seu usuário, motivo, data e hora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Situação após a reabertura</Label>
            <Select
              value={novoStatus}
              onValueChange={(v) => setNovoStatus(v as "em_analise" | "pendente")}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="pendente">Pendente de aprovação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Motivo da reabertura *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Descreva por que o resultado precisa ser corrigido (mínimo 10 caracteres)."
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
              Os responsáveis pelo documento e pela tarefa são notificados da reabertura.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={disabled}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar reabertura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
