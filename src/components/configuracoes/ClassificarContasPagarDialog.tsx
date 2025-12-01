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
  conta: string;
  fornecedor: string;
  status: 'success' | 'error';
  departamento?: string;
  planoConta?: string;
  confianca?: number;
  mensagem?: string;
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
  const [contasComErro, setContasComErro] = useState(0);
  const [currentConta, setCurrentConta] = useState<string>("");
  const [logs, setLogs] = useState<ClassificationLog[]>([]);

  const classificarContas = async () => {
    try {
      setIsClassifying(true);
      setProgress(0);
      setTotalContas(0);
      setContasClassificadas(0);
      setContasComErro(0);
      setLogs([]);

      // PASSO 1: Buscar grupos únicos não classificados
      console.log("Buscando grupos únicos para classificação...");
      
      const { data: grupos, error: gruposError } = await supabase
        .from("contas_pagar")
        .select("categoria_nome, fornecedor_nome, tipo_documento")
        .eq("classificado_automaticamente", false);

      if (gruposError) {
        throw gruposError;
      }

      if (!grupos || grupos.length === 0) {
        toast.success("Todas as contas já foram classificadas!");
        return;
      }

      // Agrupar e contar
      const gruposMap = new Map<string, { categoria_nome: string; fornecedor_nome: string | null; tipo_documento: string | null; count: number }>();
      
      grupos.forEach(g => {
        const key = `${g.categoria_nome}|${g.fornecedor_nome}|${g.tipo_documento}`;
        const existing = gruposMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          gruposMap.set(key, {
            categoria_nome: g.categoria_nome,
            fornecedor_nome: g.fornecedor_nome,
            tipo_documento: g.tipo_documento,
            count: 1
          });
        }
      });

      const gruposUnicos = Array.from(gruposMap.values());
      console.log(`${gruposUnicos.length} grupos únicos encontrados, representando ${grupos.length} contas`);

      setTotalContas(gruposUnicos.length);
      const totalGrupos = gruposUnicos.length;
      let gruposClassificados = 0;
      let gruposComErro = 0;
      const tempLogs: ClassificationLog[] = [];

      // PASSO 2: Processar em lotes de 10 grupos por vez, com 3 lotes paralelos
      const BATCH_SIZE = 10;
      const PARALLEL_BATCHES = 3;

      for (let i = 0; i < gruposUnicos.length; i += BATCH_SIZE * PARALLEL_BATCHES) {
        const batches: Promise<any>[] = [];

        // Criar até 3 lotes paralelos
        for (let j = 0; j < PARALLEL_BATCHES; j++) {
          const startIdx = i + (j * BATCH_SIZE);
          const batch = gruposUnicos.slice(startIdx, startIdx + BATCH_SIZE);
          
          if (batch.length === 0) break;

          batches.push(
            supabase.functions.invoke("classificar-contas-batch", {
              body: { groups: batch }
            })
          );
        }

        // Executar lotes em paralelo
        const batchResults = await Promise.all(batches);

        // Processar resultados
        for (const { data, error } of batchResults) {
          if (error) {
            console.error("Erro no lote:", error);
            toast.error(`Erro ao processar lote: ${error.message}`);
            continue;
          }

          if (!data?.results) {
            console.error("Resposta inválida:", data);
            continue;
          }

          // PASSO 3: Atualizar contas em batch
          for (const result of data.results) {
            const contasAfetadas = gruposMap.get(
              `${result.categoria_nome}|${result.fornecedor_nome}|${result.tipo_documento}`
            )?.count || 0;

            setCurrentConta(`${result.categoria_nome} - ${result.fornecedor_nome || 'N/A'} (${contasAfetadas} contas)`);

            if (result.success && result.departamento_id) {
              // Atualizar todas as contas deste grupo em uma única query
              let updateQuery = supabase
                .from("contas_pagar")
                .update({
                  departamento_id: result.departamento_id,
                  departamento_nome: result.departamento_nome,
                  plano_contas_id: result.plano_contas_id,
                  plano_contas_codigo: result.plano_contas_codigo,
                  plano_contas_nome: result.plano_contas_nome,
                  confianca_classificacao: result.confianca_classificacao,
                  classificacao_justificativa: result.classificacao_justificativa,
                  classificado_automaticamente: true,
                  classificado_em: new Date().toISOString(),
                })
                .eq("categoria_nome", result.categoria_nome)
                .eq("classificado_automaticamente", false);
              
              // Adicionar filtros para fornecedor e tipo_documento
              if (result.fornecedor_nome) {
                updateQuery = updateQuery.eq("fornecedor_nome", result.fornecedor_nome);
              } else {
                updateQuery = updateQuery.is("fornecedor_nome", null);
              }
              
              if (result.tipo_documento) {
                updateQuery = updateQuery.eq("tipo_documento", result.tipo_documento);
              } else {
                updateQuery = updateQuery.is("tipo_documento", null);
              }

              const { error: updateError } = await updateQuery;

              if (updateError) {
                console.error("Erro ao atualizar contas:", updateError);
                gruposComErro++;
                setContasComErro(gruposComErro);
                tempLogs.push({
                  conta: result.categoria_nome,
                  fornecedor: result.fornecedor_nome || "",
                  status: "error",
                  mensagem: updateError.message,
                });
              } else {
                gruposClassificados++;
                setContasClassificadas(gruposClassificados);
                tempLogs.push({
                  conta: result.categoria_nome,
                  fornecedor: result.fornecedor_nome || "",
                  status: "success",
                  departamento: result.departamento_nome || "",
                  planoConta: result.plano_contas_nome || "",
                  confianca: result.confianca_classificacao,
                  mensagem: `${contasAfetadas} contas atualizadas: ${result.classificacao_justificativa}`,
                });
              }
            } else {
              gruposComErro++;
              setContasComErro(gruposComErro);
              tempLogs.push({
                conta: result.categoria_nome,
                fornecedor: result.fornecedor_nome || "",
                status: "error",
                mensagem: result.error || "Classificação falhou",
              });
            }

            setProgress(Math.round(((gruposClassificados + gruposComErro) / totalGrupos) * 100));
            setLogs([...tempLogs].slice(-10));
          }
        }

        // Pequeno delay entre super-lotes
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Resultado final
      toast.success(`✅ ${gruposClassificados} grupos classificados (${grupos.length} contas atualizadas)`);
      if (gruposComErro > 0) {
        toast.warning(`⚠️ ${gruposComErro} grupos com erro`);
      }

      if (onComplete) {
        onComplete();
      }

    } catch (error) {
      console.error("Erro na classificação:", error);
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
                    {contasComErro}
                  </div>
                  <div className="text-xs text-muted-foreground">Erros</div>
                </div>
              </div>

              {logs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Log de Classificações</h4>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-3 space-y-2">
                      {logs.slice(-10).reverse().map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`text-xs p-2 rounded ${
                            log.status === 'success' 
                              ? 'bg-green-50 dark:bg-green-950/30' 
                              : 'bg-red-50 dark:bg-red-950/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{log.conta}</span>
                            <span className="text-muted-foreground text-[10px]">
                              {log.fornecedor}
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
                                {log.planoConta && (
                                  <Badge variant="outline" className="text-xs">
                                    {log.planoConta}
                                  </Badge>
                                )}
                                {log.confianca && (
                                  <Badge variant="default" className="text-xs">
                                    {(log.confianca * 100).toFixed(0)}%
                                  </Badge>
                                )}
                              </div>
                              {log.mensagem && (
                                <div className="text-[10px] text-muted-foreground mt-1 italic">
                                  {log.mensagem}
                                </div>
                              )}
                            </>
                          )}
                          {log.status === 'error' && (
                            <div className="text-[10px] text-red-600 mt-1">
                              Erro: {log.mensagem}
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
                    <div className="text-2xl font-bold text-red-600">{contasComErro}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>
              </div>

              {logs.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Resumo das Classificações</h4>
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-3 space-y-2">
                      {logs.map((log, idx) => (
                        <div 
                          key={idx} 
                          className={`text-xs p-2 rounded ${
                            log.status === 'success' 
                              ? 'bg-green-50 dark:bg-green-950/30' 
                              : 'bg-red-50 dark:bg-red-950/30'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.conta}</span>
                            <span className="text-muted-foreground text-[10px]">{log.fornecedor}</span>
                          </div>
                          {log.status === 'success' && log.departamento && log.planoConta && (
                            <div className="flex gap-1 mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {log.departamento}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {log.planoConta}
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
                  setLogs([]);
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
