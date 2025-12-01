import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClassificarContasEmLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: any[];
}

export function ClassificarContasEmLoteDialog({
  open,
  onOpenChange,
  onSuccess,
  accounts
}: ClassificarContasEmLoteDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [currentAccount, setCurrentAccount] = useState<string>("");

  const handleClassifyAll = async () => {
    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    // Filtrar apenas contas sem departamento ou não definidas manualmente
    const contasParaClassificar = accounts.filter(
      acc => !acc.departamento_definido_manualmente && !acc.departamento_id
    );

    if (contasParaClassificar.length === 0) {
      toast.info("Todas as contas já possuem departamento definido!");
      setIsProcessing(false);
      return;
    }

    const total = contasParaClassificar.length;
    let processados = 0;
    const resultados: any[] = [];

    for (const account of contasParaClassificar) {
      setCurrentAccount(`${account.code} - ${account.name}`);

      try {
        // Chamar IA para classificar
        const { data, error } = await supabase.functions.invoke('classificar-conta-departamento', {
          body: {
            accountCode: account.code,
            accountName: account.name,
            accountDescription: account.description || "",
            accountType: account.account_type
          }
        });

        if (error) throw error;

        if (data?.success) {
          // Atualizar conta no banco
          const { error: updateError } = await supabase
            .from('trade_chart_of_accounts')
            .update({
              departamento_id: data.departamento_id,
              departamento_confianca: data.confianca,
              departamento_definido_manualmente: false
            })
            .eq('id', account.id);

          if (updateError) throw updateError;

          resultados.push({
            conta: `${account.code} - ${account.name}`,
            departamento: data.departamento_nome,
            confianca: data.confianca,
            sucesso: true
          });
        }
      } catch (error: any) {
        console.error(`Erro ao classificar ${account.code}:`, error);
        resultados.push({
          conta: `${account.code} - ${account.name}`,
          erro: error.message,
          sucesso: false
        });
      }

      processados++;
      setProgress((processados / total) * 100);
      setResults([...resultados]);

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsProcessing(false);
    setCurrentAccount("");
    toast.success(`${processados} contas classificadas com sucesso!`);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Classificar Contas com IA
          </DialogTitle>
          <DialogDescription>
            A IA irá analisar e classificar automaticamente todas as contas sem departamento definido.
            Contas definidas manualmente não serão alteradas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isProcessing && results.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                {accounts.filter(acc => !acc.departamento_definido_manualmente && !acc.departamento_id).length} contas
                serão classificadas automaticamente
              </p>
              <Button onClick={handleClassifyAll}>
                Iniciar Classificação
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Processando...</p>
                  <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              
              {currentAccount && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground">{currentAccount}</span>
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Resultados:</p>
              <ScrollArea className="h-[300px] border rounded-md p-4">
                <div className="space-y-2">
                  {results.map((result, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm p-2 rounded bg-accent/30">
                      {result.sucesso ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{result.conta}</p>
                            <p className="text-xs text-muted-foreground">
                              → {result.departamento} ({Math.round(result.confianca * 100)}%)
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{result.conta}</p>
                            <p className="text-xs text-red-600">{result.erro}</p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {!isProcessing && results.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
