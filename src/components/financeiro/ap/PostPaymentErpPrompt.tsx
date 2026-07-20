import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AtrioContaBancaria {
  id:        number;
  descricao: string;
  banco:     string;
}

interface PostPaymentErpPromptProps {
  open:                boolean;
  onOpenChange:        (open: boolean) => void;
  tituloId:            string;
  empresaId?:          number;   // empresa_id do título/fila; default 1
  onConfirm:           (contaId: number | null) => Promise<void>;
  onSkip:              () => void;
  skipContaSelection?: boolean;  // true = oculta seletor (fluxos de provisão/legado)
}

export function PostPaymentErpPrompt({
  open,
  onOpenChange,
  tituloId,
  empresaId = 1,
  onConfirm,
  onSkip,
  skipContaSelection = false,
}: PostPaymentErpPromptProps) {
  const [loading,      setLoading]      = useState(false);
  const [contaId,      setContaId]      = useState<number | null>(null);
  const [contas,       setContas]        = useState<AtrioContaBancaria[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);

  // Carregar lista de contas bancárias quando o dialog abre (somente se necessário)
  useEffect(() => {
    if (!open || !tituloId || skipContaSelection) return;

    setContaId(null);
    setContas([]);
    setLoadingContas(true);

    supabase.functions.invoke("atrio-get-contas", {
      body: { empresa_id: empresaId },
    }).then(({ data, error }) => {
      if (!error && data?.contas) {
        setContas(data.contas as AtrioContaBancaria[]);
      }
    }).finally(() => setLoadingContas(false));
  }, [open, tituloId, empresaId, skipContaSelection]);

  const handleConfirm = async () => {
    if (!skipContaSelection && !contaId) return;
    setLoading(true);
    try {
      await onConfirm(contaId);
    } finally {
      setLoading(false);
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    setContaId(null);
    setContas([]);
  };

  const canConfirm = (skipContaSelection || contaId !== null) && !loading;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Exportar baixa ao ERP?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Pagamento registrado com sucesso. Selecione a conta bancária de saída
            e confirme para registrar a baixa no ERP SIGED.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!skipContaSelection && (
          <div className="space-y-2 py-2">
            <Label>Conta bancária de saída</Label>
            {loadingContas ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando contas...
              </div>
            ) : (
              <Select
                value={contaId ? String(contaId) : ""}
                onValueChange={(v) => setContaId(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta..." />
                </SelectTrigger>
                <SelectContent>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.descricao}{c.banco ? ` — ${c.banco}` : ""}
                    </SelectItem>
                  ))}
                  {contas.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      Nenhuma conta disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleSkip} disabled={loading}>
            Agora não
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar ao ERP
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
