import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2, Copy, Check } from "lucide-react";

interface MFAEnrollDialogProps {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

export function MFAEnrollDialog({ open, onClose, onEnrolled }: MFAEnrollDialogProps) {
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError("");
    setCopied(false);
    enrollFactor();
  }, [open]);

  const enrollFactor = async () => {
    setEnrolling(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "BiMaster Authenticator",
      });

      if (enrollError) {
        setError("Erro ao gerar QR Code: " + enrollError.message);
        return;
      }

      if (data) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch {
      setError("Erro ao iniciar enrollment MFA.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      const { data, error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (verifyError) {
        setError("Código inválido. Tente novamente.");
        setCode("");
        return;
      }

      if (data) {
        toast({ title: "✅ MFA ativado!", description: "Autenticação em duas etapas configurada com sucesso." });
        onEnrolled();
      }
    } catch {
      setError("Erro ao verificar código.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = async () => {
    // Unenroll the factor if it was created but not verified
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => {});
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <DialogTitle>Ativar autenticação em duas etapas</DialogTitle>
          </div>
          <DialogDescription>
            Escaneie o QR Code com seu aplicativo autenticador (Google Authenticator, Authy, etc.)
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {enrolling ? (
            <div className="flex items-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Gerando QR Code...</span>
            </div>
          ) : (
            <>
              {qrCode && (
                <div className="bg-white p-3 rounded-lg border">
                  <img src={qrCode} alt="QR Code MFA" className="w-48 h-48" />
                </div>
              )}

              {secret && (
                <div className="w-full">
                  <p className="text-xs text-muted-foreground mb-1">Ou insira manualmente:</p>
                  <div className="flex items-center gap-2 bg-muted rounded-md p-2">
                    <code className="text-xs flex-1 break-all font-mono">{secret}</code>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copySecret}>
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="w-full space-y-2">
                <p className="text-sm font-medium">Insira o código de 6 dígitos:</p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={handleVerify}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleVerify} disabled={loading || code.length !== 6 || enrolling}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ativar MFA"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
