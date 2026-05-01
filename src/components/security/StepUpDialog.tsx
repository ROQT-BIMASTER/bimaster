import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { requestStepUp } from "@/hooks/useMfa";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scope: string;
  /** Called with the issued step-up token. The caller then forwards it to the privileged endpoint. */
  onSuccess: (token: string) => void;
  description?: string;
}

/**
 * Modal for step-up authentication. Requests a TOTP code, exchanges it for a
 * single-use token (TTL 5min) bound to a specific scope. The caller is
 * responsible for sending that token in the X-Step-Up-Token header of the
 * sensitive operation.
 */
export function StepUpDialog({ open, onOpenChange, scope, onSuccess, description }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Digite o código de 6 dígitos");
      return;
    }
    setBusy(true);
    try {
      const r = await requestStepUp(scope, code);
      toast.success("Verificação concluída");
      setCode("");
      onSuccess(r.token);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na verificação");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Confirmação de segurança
          </DialogTitle>
          <DialogDescription>
            {description ?? "Esta ação é sensível. Insira o código do seu app autenticador para continuar."}
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handle()}
          placeholder="000000"
          maxLength={6}
          className="text-center text-2xl tracking-widest font-mono"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={busy}>{busy ? "Validando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
