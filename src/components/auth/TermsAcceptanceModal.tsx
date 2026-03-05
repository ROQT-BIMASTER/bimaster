import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useTermsAcceptance } from "@/hooks/useTermsAcceptance";
import { toast } from "@/hooks/use-toast";
import { FileText, Shield } from "lucide-react";

export const TermsAcceptanceModal = () => {
  const { needsAcceptance, loading, acceptTerms } = useTermsAcceptance();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading || !needsAcceptance) return null;

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await acceptTerms();
      toast({
        title: "Termos aceitos",
        description: "Obrigado por aceitar nossos termos e política de privacidade.",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível registrar o aceite. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Termos e Política de Privacidade
          </DialogTitle>
          <DialogDescription>
            Para continuar utilizando o sistema, é necessário aceitar nossos termos atualizados conforme a LGPD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <a
            href="/politica-privacidade"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            Política de Privacidade
          </a>
          <a
            href="/termos-de-uso"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <FileText className="h-4 w-4" />
            Termos de Uso
          </a>
        </div>

        <div className="flex items-start gap-3 py-2">
          <Checkbox
            id="accept-terms"
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
          />
          <label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
            Li e aceito a Política de Privacidade e os Termos de Uso do sistema.
          </label>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="w-full"
          >
            {submitting ? "Registrando..." : "Aceitar e Continuar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
