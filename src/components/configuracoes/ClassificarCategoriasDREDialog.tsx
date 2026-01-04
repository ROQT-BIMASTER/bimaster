import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ClassificarCategoriasDREDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: Array<{
    id: string;
    code: string;
    name: string;
    account_type: string;
    categoria_dre: string | null;
  }>;
}

interface ResultadoClassificacao {
  conta: string;
  categoria?: string;
  confianca?: number;
  justificativa?: string;
  erro?: string;
  sucesso: boolean;
  pulada?: boolean;
}

const CATEGORIA_COLORS: Record<string, string> = {
  'receita_bruta': 'bg-emerald-500/20 text-emerald-700',
  'deducoes': 'bg-orange-500/20 text-orange-700',
  'custo_vendas': 'bg-red-500/20 text-red-700',
  'despesas_fixas': 'bg-blue-500/20 text-blue-700',
  'impostos_lucro': 'bg-purple-500/20 text-purple-700',
};

export function ClassificarCategoriasDREDialog({
  open,
  onOpenChange,
  onSuccess,
  accounts
}: ClassificarCategoriasDREDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultadoClassificacao[]>([]);
  const [currentAccount, setCurrentAccount] = useState<string>("");

  // Filtrar contas não classificadas
  const contasParaClassificar = accounts.filter(acc => !acc.categoria_dre);

  const handleClassifyAll = async () => {
    if (contasParaClassificar.length === 0) {
      toast.info("Todas as contas já possuem categoria DRE definida!");
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    const total = contasParaClassificar.length;
    let processados = 0;
    const resultados: ResultadoClassificacao[] = [];

    for (const account of contasParaClassificar) {
      setCurrentAccount(`${account.code} - ${account.name}`);

      try {
        // Chamar IA para classificar
        const { data, error } = await supabase.functions.invoke('classificar-categoria-dre', {
          body: {
            accountCode: account.code,
            accountName: account.name,
            accountType: account.account_type
          }
        });

        if (error) throw error;

        if (data?.success) {
          if (data.categoria_dre) {
            // Atualizar conta no banco
            const { error: updateError } = await supabase
              .from('trade_chart_of_accounts')
              .update({ categoria_dre: data.categoria_dre })
              .eq('id', account.id);

            if (updateError) throw updateError;

            resultados.push({
              conta: `${account.code} - ${account.name}`,
              categoria: data.categoria_label,
              confianca: data.confianca,
              justificativa: data.justificativa,
              sucesso: true
            });
          } else {
            // Conta não se encaixa em nenhuma categoria DRE
            resultados.push({
              conta: `${account.code} - ${account.name}`,
              justificativa: data.justificativa || "Não aplicável para DRE",
              sucesso: true,
              pulada: true
            });
          }
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

      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsProcessing(false);
    setCurrentAccount("");
    
    const classificadas = resultados.filter(r => r.sucesso && !r.pulada).length;
    const puladas = resultados.filter(r => r.pulada).length;
    const erros = resultados.filter(r => !r.sucesso).length;
    
    if (classificadas > 0) {
      toast.success(`${classificadas} contas classificadas com sucesso!`);
    }
    if (puladas > 0) {
      toast.info(`${puladas} contas não se aplicam à DRE`);
    }
    if (erros > 0) {
      toast.error(`${erros} erros durante classificação`);
    }
    
    onSuccess();
  };

  const stats = {
    classificadas: results.filter(r => r.sucesso && !r.pulada).length,
    puladas: results.filter(r => r.pulada).length,
    erros: results.filter(r => !r.sucesso).length
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Classificar Categorias DRE com IA
          </DialogTitle>
          <DialogDescription>
            A IA irá analisar e sugerir a categoria DRE para todas as contas não classificadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isProcessing && results.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                <span className="text-2xl font-bold text-foreground block mb-1">
                  {contasParaClassificar.length}
                </span>
                contas serão analisadas
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Contas já classificadas manualmente não serão alteradas
              </p>
              <Button onClick={handleClassifyAll} disabled={contasParaClassificar.length === 0}>
                <Sparkles className="h-4 w-4 mr-2" />
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
                <div className="flex items-center gap-2 text-sm p-3 rounded-lg bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-muted-foreground truncate">{currentAccount}</span>
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              {/* Estatísticas */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>{stats.classificadas} classificadas</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span>{stats.puladas} não aplicáveis</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{stats.erros} erros</span>
                </div>
              </div>

              <ScrollArea className="h-[350px] border rounded-md">
                <div className="p-3 space-y-2">
                  {results.map((result, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 text-sm p-2 rounded ${
                        result.sucesso 
                          ? result.pulada 
                            ? 'bg-amber-500/10' 
                            : 'bg-emerald-500/10'
                          : 'bg-red-500/10'
                      }`}
                    >
                      {result.sucesso ? (
                        result.pulada ? (
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        )
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.conta}</p>
                        {result.sucesso && !result.pulada && result.categoria && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${CATEGORIA_COLORS[result.categoria.toLowerCase().replace(/ /g, '_')] || ''}`}
                            >
                              {result.categoria}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {Math.round((result.confianca || 0) * 100)}% confiança
                            </span>
                          </div>
                        )}
                        {result.justificativa && (
                          <p className="text-xs text-muted-foreground mt-1">{result.justificativa}</p>
                        )}
                        {result.erro && (
                          <p className="text-xs text-red-600 mt-1">{result.erro}</p>
                        )}
                      </div>
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
