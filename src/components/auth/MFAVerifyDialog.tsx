import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";

interface MFAVerifyDialogProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MFAVerifyDialog({ open, onSuccess, onCancel }: MFAVerifyDialogProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.find(f => f.status === "verified");

      if (!totpFactor) {
        setError("Nenhum fator MFA encontrado.");
        return;
      }

      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code,
      });

      if (verifyError) {
        setError("Código inválido. Tente novamente.");
        setCode("");
        return;
      }

      if (data) {
        onSuccess();
      }
    } catch {
      setError("Erro ao verificar código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Verificação em duas etapas</DialogTitle>
          </div>
          <DialogDescription>
            Insira o código de 6 dígitos do seu aplicativo autenticador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            onComplete={handleVerify}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleVerify} disabled={loading || code.length !== 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
