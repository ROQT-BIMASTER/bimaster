import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { MFAEnrollDialog } from "@/components/auth/MFAEnrollDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function MFASettings() {
  const [hasMFA, setHasMFA] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const { toast } = useToast();

  const checkMFAStatus = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verifiedTOTP = data?.totp?.find(f => f.status === "verified");
      setHasMFA(!!verifiedTOTP);
      setFactorId(verifiedTOTP?.id || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const handleDisableMFA = async () => {
    if (!factorId) return;
    setDisabling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) {
        toast({ title: "Erro", description: "Não foi possível desativar o MFA: " + error.message, variant: "destructive" });
        return;
      }
      setHasMFA(false);
      setFactorId(null);
      toast({ title: "MFA desativado", description: "A autenticação em duas etapas foi removida da sua conta." });
    } catch {
      toast({ title: "Erro", description: "Falha ao desativar MFA.", variant: "destructive" });
    } finally {
      setDisabling(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {hasMFA ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
                Autenticação em duas etapas (2FA)
              </CardTitle>
              <CardDescription className="mt-1">
                {hasMFA
                  ? "Sua conta está protegida com autenticação em duas etapas."
                  : "Adicione uma camada extra de segurança à sua conta."
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasMFA ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={disabling}>
                  {disabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Desativar 2FA
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desativar autenticação em duas etapas?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso removerá a camada extra de segurança da sua conta. Você precisará apenas de email e senha para fazer login.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisableMFA} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Desativar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button onClick={() => setShowEnroll(true)}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Ativar 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <MFAEnrollDialog
        open={showEnroll}
        onClose={() => setShowEnroll(false)}
        onEnrolled={() => {
          setShowEnroll(false);
          checkMFAStatus();
        }}
      />
    </>
  );
}
