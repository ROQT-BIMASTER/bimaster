import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface PostPaymentErpPromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tituloId: string;
  onConfirm: () => Promise<void>;
  onSkip: () => void;
}

export function PostPaymentErpPrompt({
  open,
  onOpenChange,
  tituloId,
  onConfirm,
  onSkip,
}: PostPaymentErpPromptProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Exportar baixa ao ERP?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Pagamento registrado com sucesso. Deseja marcar este título para
            exportação de baixa ao ERP?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onSkip} disabled={loading}>
            Agora não
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar ao ERP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
