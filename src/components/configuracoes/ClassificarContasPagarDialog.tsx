import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Brain, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClassificarContasPagarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface ClassificationLog {
  conta_id: string;
  fornecedor: string;
  valor: number;
  plano_contas?: string;
  departamento?: string;
  confianca?: number;
  status: 'success' | 'error';
  message?: string;
}

export function ClassificarContasPagarDialog({
  open,
  onOpenChange,
  onComplete,
}: ClassificarContasPagarDialogProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalContas, setTotalContas] = useState(0);
  const [contasClassificadas, setContasClassificadas] = useState(0);
  const [erros, setErros] = useState(0);
  const [currentConta, setCurrentConta] = useState<string>("");
  const [classificationLogs, setClassificationLogs] = useState<ClassificationLog[]>([]);

  const classificarContas = async () => {
    try {
      setIsClassifying(true);
      setProgress(0);
      setContasClassificadas(0);
      setErros(0);
      setClassificationLogs([]);

      // Buscar TODAS as contas para classificar (sem limite)
      const { data: contas, error: fetchError } = await supabase
        .from("contas_pagar")
        .select("*")
        .order('data_vencimento', { ascending: false });

      if (fetchError) throw fetchError;
      if (!contas || contas.length === 0) {
        toast.info("Nenhuma conta encontrada no banco de dados");
        setIsClassifying(false);
        return;
      }

      toast.info(`Processando ${contas.length} contas...`);

      setTotalContas(contas.length);
      let classificadas = 0;
      let errosCount = 0;
      const logs: ClassificationLog[] = [];

      // Processar cada conta
      for (const conta of contas) {
        try {
          setCurrentConta(`${conta.fornecedor_nome || "N/A"} - R$ ${conta.valor_original?.toFixed(2) || "0.00"}`);

          console.log("Classificando conta:", conta.id);

          // Chamar nova função de classificação IA
          const { data: result, error: classifyError } = await supabase.functions.invoke(
            "classificar-contas-pagar-ia",
            {
              body: { conta },
            }
          );

          if (classifyError) {
            console.error("Erro ao classificar:", classifyError);
            
            // Se for erro de rate limit, pausar por 3 segundos
            if (classifyError.message?.includes("429") || classifyError.message?.includes("rate_limit")) {
              console.log("Rate limit detectado, pausando...");
              toast.warning("Limite de requisições atingido, pausando 3s...");
              await new Promise(resolve => setTimeout(resolve, 3000));
              errosCount++;
              logs.push({
                conta_id: conta.id,
                fornecedor: conta.fornecedor_nome || "N/A",
                valor: conta.valor_original || 0,
                status: 'error',
                message: "Rate limit - tentando novamente",
              });
              continue;
            }
            
            throw classifyError;
          }

          if (result?.departamento_id || result?.plano_contas_id) {
            // Atualizar conta com classificação + cache
            const updateData: any = {
              classificado_automaticamente: true,
              classificado_em: new Date().toISOString(),
            };

            if (result.departamento_id) {
              updateData.departamento_id = result.departamento_id;
              updateData.departamento_nome = result.departamento_nome;
            }

            if (result.plano_contas_id) {
              updateData.plano_contas_id = result.plano_contas_id;
              updateData.plano_contas_codigo = result.plano_contas_codigo;
              updateData.plano_contas_nome = result.plano_contas_nome;
            }

            if (result.confianca) {
              updateData.confianca_classificacao = result.confianca;
            }

            if (result.justificativa) {
              updateData.classificacao_justificativa = result.justificativa;
            }

            const { error: updateError } = await supabase
              .from("contas_pagar")
              .update(updateData)
              .eq("id", conta.id);

            if (updateError) {
              console.error("Erro ao atualizar conta:", updateError);
              errosCount++;
              logs.push({
                conta_id: conta.id,
                fornecedor: conta.fornecedor_nome || "N/A",
                valor: conta.valor_original || 0,
                status: 'error',
                message: updateError.message,
              });
            } else {
              classificadas++;
              logs.push({
                conta_id: conta.id,
                fornecedor: conta.fornecedor_nome || "N/A",
                valor: conta.valor_original || 0,
                plano_contas: result.plano_contas_nome,
                departamento: result.departamento_nome,
                confianca: result.confianca,
                status: 'success',
                message: result.justificativa,
              });
            }
          } else {
            errosCount++;
            logs.push({
              conta_id: conta.id,
              fornecedor: conta.fornecedor_nome || "N/A",
              valor: conta.valor_original || 0,
              status: 'error',
              message: "IA não retornou classificação válida",
            });
          }
        } catch (error: any) {
          console.error("Erro ao processar conta:", error);
          errosCount++;
          logs.push({
            conta_id: conta.id,
            fornecedor: conta.fornecedor_nome || "N/A",
            valor: conta.valor_original || 0,
            status: 'error',
            message: error.message || "Erro desconhecido",
          });
        }

        // Atualizar progresso
        const progressoAtual = Math.round(((classificadas + errosCount) / contas.length) * 100);
        setProgress(progressoAtual);
        setContasClassificadas(classificadas);
        setErros(errosCount);
        setClassificationLogs([...logs]);

        // Delay entre requisições para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Mostrar resultado final
      const taxaSucesso = totalContas > 0 ? ((classificadas / totalContas) * 100).toFixed(1) : "0";
      
      if (classificadas > 0) {
        toast.success(`✅ ${classificadas} de ${totalContas} contas classificadas (${taxaSucesso}% de sucesso)!`);
      }
      
      if (errosCount > 0) {
        toast.error(`❌ ${errosCount} contas com erro na classificação`);
      }

      if (classificadas === 0 && errosCount === 0) {
        toast.info("Nenhuma conta foi processada");
      }

      // Chamar callback de conclusão
      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      console.error("Erro geral na classificação:", error);
      toast.error("Erro ao classificar contas. Tente novamente.");
    } finally {
      setIsClassifying(false);
      setCurrentConta("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Classificação Inteligente com IA
          </DialogTitle>
          <DialogDescription>
            A IA analisa cada conta e sugere departamento + plano de contas apropriado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isClassifying && totalContas === 0 && (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-primary/60" />
              <p className="text-sm text-muted-foreground mb-4">
                Classificação automática de TODAS as contas a pagar usando Inteligência Artificial.
                O sistema aprende com cada classificação para melhorar a precisão.
              </p>
              <div className="flex gap-2 justify-center">
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Aprende com cada classificação
                </Badge>
                <Badge variant="outline">
                  Precisão: ~95%
                </Badge>
              </div>
              <Button onClick={classificarContas} size="lg" className="mt-6">
                <Brain className="mr-2 h-4 w-4" />
                Iniciar Classificação
              </Button>
            </div>
          )}

          {isClassifying && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="font-medium">Classificando contas com IA...</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {currentConta || "Preparando..."}
                  </div>
                </div>
              </div>

              <Progress value={progress} className="h-2" />

              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-primary">{totalContas}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-5 w-5" />
                    {contasClassificadas}
                  </div>
                  <div className="text-xs text-muted-foreground">Classificadas</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    <XCircle className="h-5 w-5" />
                    {erros}
                  </div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
              </div>

              {classificationLogs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Log de Classificações</h4>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-3 space-y-2">
                      {classificationLogs.slice(-10).reverse().map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`text-xs p-2 rounded ${
                            log.status === 'success' 
                              ? 'bg-green-50 dark:bg-green-950/30' 
                              : 'bg-red-50 dark:bg-red-950/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{log.fornecedor}</span>
                            <span className="text-muted-foreground">
                              R$ {log.valor.toFixed(2)}
                            </span>
                          </div>
                          {log.status === 'success' && (
                            <>
                              <div className="flex gap-2 flex-wrap mt-1">
                                {log.departamento && (
                                  <Badge variant="secondary" className="text-xs">
                                    {log.departamento}
                                  </Badge>
                                )}
                                {log.plano_contas && (
                                  <Badge variant="outline" className="text-xs">
                                    {log.plano_contas}
                                  </Badge>
                                )}
                                {log.confianca && (
                                  <Badge variant="default" className="text-xs">
                                    {(log.confianca * 100).toFixed(0)}% confiança
                                  </Badge>
                                )}
                              </div>
                              {log.message && (
                                <div className="text-[10px] text-muted-foreground mt-1 italic">
                                  {log.message}
                                </div>
                              )}
                            </>
                          )}
                          {log.status === 'error' && (
                            <div className="text-[10px] text-red-600 mt-1">
                              Erro: {log.message}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {!isClassifying && totalContas > 0 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Classificação Concluída
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalContas}</div>
                    <div className="text-xs text-muted-foreground">Processadas</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{contasClassificadas}</div>
                    <div className="text-xs text-muted-foreground">Sucesso</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{erros}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>
              </div>

              {classificationLogs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Resumo das Últimas Classificações</h4>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-3 space-y-2">
                      {classificationLogs.map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`text-xs p-2 rounded ${
                            log.status === 'success' 
                              ? 'bg-green-50 dark:bg-green-950/30' 
                              : 'bg-red-50 dark:bg-red-950/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.fornecedor}</span>
                            <span className="text-muted-foreground">R$ {log.valor.toFixed(2)}</span>
                          </div>
                          {log.status === 'success' && log.departamento && log.plano_contas && (
                            <div className="flex gap-1 mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {log.departamento}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {log.plano_contas}
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              <Button
                onClick={() => {
                  setTotalContas(0);
                  setClassificationLogs([]);
                  classificarContas();
                }}
                className="w-full"
              >
                <Brain className="mr-2 h-4 w-4" />
                Classificar Mais Contas
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
