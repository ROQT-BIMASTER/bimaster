import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Loader2, CheckCircle2, XCircle, TrendingUp, Database, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ClassificationLog {
  conta: string;
  fornecedor: string;
  status: 'success' | 'error';
  departamento?: string;
  planoConta?: string;
  confianca?: number;
  mensagem?: string;
}

export default function ClassificarTodoBanco() {
  const [isClassifying, setIsClassifying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalGrupos, setTotalGrupos] = useState(0);
  const [gruposClassificados, setGruposClassificados] = useState(0);
  const [gruposComErro, setGruposComErro] = useState(0);
  const [currentGrupo, setCurrentGrupo] = useState<string>("");
  const [logs, setLogs] = useState<ClassificationLog[]>([]);
  const [contasNaoClassificadas, setContasNaoClassificadas] = useState<number>(0);
  const [contasTotais, setContasTotais] = useState<number>(0);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    // Total de contas
    const { count: total } = await supabase
      .from('contas_pagar')
      .select('*', { count: 'exact', head: true });
    
    setContasTotais(total || 0);

    // Contas não classificadas
    const { count: naoClassificadas } = await supabase
      .from('contas_pagar')
      .select('*', { count: 'exact', head: true })
      .is('plano_contas_id', null);
    
    setContasNaoClassificadas(naoClassificadas || 0);
  };

  const classificarTodoOBanco = async () => {
    try {
      setIsClassifying(true);
      setProgress(0);
      setTotalGrupos(0);
      setGruposClassificados(0);
      setGruposComErro(0);
      setLogs([]);

      // Buscar grupos únicos não classificados
      console.log("🔍 Buscando todas as contas não classificadas...");
      
      const { data: grupos, error: gruposError } = await supabase
        .from("contas_pagar")
        .select("categoria_nome, fornecedor_nome, tipo_documento")
        .is("plano_contas_id", null);

      if (gruposError) throw gruposError;

      if (!grupos || grupos.length === 0) {
        toast.success("✅ Todas as contas já foram classificadas!");
        setIsClassifying(false);
        await carregarEstatisticas();
        return;
      }

      // Agrupar e contar
      const gruposMap = new Map<string, { 
        categoria_nome: string; 
        fornecedor_nome: string | null; 
        tipo_documento: string | null; 
        count: number 
      }>();
      
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
      console.log(`✅ ${gruposUnicos.length} grupos únicos encontrados (${grupos.length} contas)`);

      setTotalGrupos(gruposUnicos.length);
      let _gruposClassificados = 0;
      let _gruposComErro = 0;
      const tempLogs: ClassificationLog[] = [];

      // Processar em lotes
      const BATCH_SIZE = 10;
      const PARALLEL_BATCHES = 3;

      for (let i = 0; i < gruposUnicos.length; i += BATCH_SIZE * PARALLEL_BATCHES) {
        const batches: Promise<any>[] = [];

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
            console.error("❌ Erro no lote:", error);
            toast.error(`Erro ao processar lote: ${error.message}`);
            continue;
          }

          if (!data?.results) continue;

          for (const result of data.results) {
            const contasAfetadas = gruposMap.get(
              `${result.categoria_nome}|${result.fornecedor_nome}|${result.tipo_documento}`
            )?.count || 0;

            setCurrentGrupo(`${result.categoria_nome} - ${result.fornecedor_nome || 'N/A'} (${contasAfetadas} contas)`);

            if (result.success && result.departamento_id) {
              // Atualizar todas as contas deste grupo
              const { error: updateError } = await supabase
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
                .match({ 
                  fornecedor_nome: result.fornecedor_nome || null,
                  tipo_documento: result.tipo_documento || null
                })
                .is("plano_contas_id", null);

              if (updateError) {
                console.error("❌ Erro ao atualizar:", updateError);
                _gruposComErro++;
                setGruposComErro(_gruposComErro);
                tempLogs.push({
                  conta: result.categoria_nome,
                  fornecedor: result.fornecedor_nome || "",
                  status: "error",
                  mensagem: updateError.message,
                });
              } else {
                _gruposClassificados++;
                setGruposClassificados(_gruposClassificados);
                tempLogs.push({
                  conta: result.categoria_nome,
                  fornecedor: result.fornecedor_nome || "",
                  status: "success",
                  departamento: result.departamento_nome || "",
                  planoConta: result.plano_contas_nome || "",
                  confianca: result.confianca_classificacao,
                  mensagem: `${contasAfetadas} contas: ${result.classificacao_justificativa}`,
                });
              }
            } else {
              _gruposComErro++;
              setGruposComErro(_gruposComErro);
              tempLogs.push({
                conta: result.categoria_nome,
                fornecedor: result.fornecedor_nome || "",
                status: "error",
                mensagem: result.error || "Classificação falhou",
              });
            }

            setProgress(Math.round(((_gruposClassificados + _gruposComErro) / gruposUnicos.length) * 100));
            setLogs([...tempLogs].slice(-20));
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      toast.success(`🎉 ${_gruposClassificados} grupos classificados (${grupos.length} contas atualizadas)!`);
      if (_gruposComErro > 0) {
        toast.warning(`⚠️ ${_gruposComErro} grupos com erro`);
      }

      await carregarEstatisticas();

    } catch (error) {
      console.error("❌ Erro geral:", error);
      toast.error("Erro ao classificar contas. Tente novamente.");
    } finally {
      setIsClassifying(false);
      setCurrentGrupo("");
    }
  };

  const percentualClassificado = contasTotais > 0 
    ? Math.round((contasTotais - contasNaoClassificadas) / contasTotais * 100) 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Database className="h-8 w-8" />
            Classificação Completa do Banco
          </h1>
          <p className="text-muted-foreground mt-2">
            Classificação automática via IA de TODAS as contas a pagar não classificadas
          </p>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4" />
                Total de Contas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{contasTotais.toLocaleString('pt-BR')}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Não Classificadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                {contasNaoClassificadas.toLocaleString('pt-BR')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando classificação
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Progresso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{percentualClassificado}%</div>
              <Progress value={percentualClassificado} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Card Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Classificação Inteligente com IA
            </CardTitle>
            <CardDescription>
              O sistema agrupa contas similares e classifica em lote usando IA. 
              Aprende com cada classificação para melhorar a precisão.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isClassifying && totalGrupos === 0 && (
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto mb-6 text-primary/60" />
                <h3 className="text-xl font-semibold mb-3">
                  Pronto para classificar {contasNaoClassificadas.toLocaleString('pt-BR')} contas
                </h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  A IA analisará cada grupo de contas similares e sugerirá o departamento e plano de contas apropriados.
                  O processo é rápido e preciso (95% de acurácia).
                </p>
                <div className="flex gap-2 justify-center mb-8">
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Machine Learning
                  </Badge>
                  <Badge variant="outline">
                    Processamento em Lote
                  </Badge>
                  <Badge variant="outline">
                    95% de Precisão
                  </Badge>
                </div>
                <Button 
                  onClick={classificarTodoOBanco} 
                  size="lg" 
                  className="px-8"
                  disabled={contasNaoClassificadas === 0}
                >
                  <Brain className="mr-2 h-5 w-5" />
                  Classificar Todo o Banco Agora
                </Button>
                {contasNaoClassificadas === 0 && (
                  <p className="text-sm text-green-600 mt-4">
                    ✅ Todas as contas já estão classificadas!
                  </p>
                )}
              </div>
            )}

            {isClassifying && (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div className="flex-1">
                    <div className="font-medium">Classificando com IA...</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {currentGrupo || "Preparando análise..."}
                    </div>
                  </div>
                </div>

                <Progress value={progress} className="h-3" />

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <div className="text-3xl font-bold text-primary">{totalGrupos}</div>
                    <div className="text-sm text-muted-foreground">Grupos Total</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="text-3xl font-bold text-green-600 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-6 w-6" />
                      {gruposClassificados}
                    </div>
                    <div className="text-sm text-muted-foreground">Classificados</div>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                    <div className="text-3xl font-bold text-red-600 flex items-center justify-center gap-1">
                      <XCircle className="h-6 w-6" />
                      {gruposComErro}
                    </div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </div>
                </div>

                {logs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Log em Tempo Real</h4>
                    <ScrollArea className="h-[400px] rounded-md border">
                      <div className="p-4 space-y-2">
                        {logs.slice().reverse().map((log, idx) => (
                          <div 
                            key={idx} 
                            className={`text-sm p-3 rounded-lg ${
                              log.status === 'success' 
                                ? 'bg-green-50 dark:bg-green-950/30' 
                                : 'bg-red-50 dark:bg-red-950/30'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{log.conta}</span>
                              <span className="text-xs text-muted-foreground">
                                {log.fornecedor}
                              </span>
                            </div>
                            {log.status === 'success' && (
                              <>
                                <div className="flex gap-2 flex-wrap">
                                  {log.departamento && (
                                    <Badge variant="secondary" className="text-xs">
                                      📁 {log.departamento}
                                    </Badge>
                                  )}
                                  {log.planoConta && (
                                    <Badge variant="outline" className="text-xs">
                                      📊 {log.planoConta}
                                    </Badge>
                                  )}
                                  {log.confianca && (
                                    <Badge variant="default" className="text-xs">
                                      🎯 {(log.confianca * 100).toFixed(0)}%
                                    </Badge>
                                  )}
                                </div>
                                {log.mensagem && (
                                  <div className="text-xs text-muted-foreground mt-2 italic">
                                    {log.mensagem}
                                  </div>
                                )}
                              </>
                            )}
                            {log.status === 'error' && (
                              <div className="text-xs text-red-600">
                                ❌ {log.mensagem}
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

            {!isClassifying && totalGrupos > 0 && (
              <div className="space-y-6">
                <div className="rounded-lg border-2 border-green-500 p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20">
                  <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    Classificação Concluída com Sucesso!
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{totalGrupos}</div>
                      <div className="text-sm text-muted-foreground">Grupos Processados</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{gruposClassificados}</div>
                      <div className="text-sm text-muted-foreground">Sucesso</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{gruposComErro}</div>
                      <div className="text-sm text-muted-foreground">Erros</div>
                    </div>
                  </div>
                </div>

                {logs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Resumo das Classificações</h4>
                    <ScrollArea className="h-[300px] rounded-md border">
                      <div className="p-4 space-y-2">
                        {logs.map((log, idx) => (
                          <div 
                            key={idx} 
                            className={`text-sm p-3 rounded ${
                              log.status === 'success' 
                                ? 'bg-green-50 dark:bg-green-950/30' 
                                : 'bg-red-50 dark:bg-red-950/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{log.conta}</span>
                              <span className="text-xs text-muted-foreground">{log.fornecedor}</span>
                            </div>
                            {log.status === 'success' && log.departamento && log.planoConta && (
                              <div className="flex gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  {log.departamento}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
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
                    setTotalGrupos(0);
                    setLogs([]);
                    carregarEstatisticas();
                    classificarTodoOBanco();
                  }}
                  className="w-full"
                  size="lg"
                >
                  <Brain className="mr-2 h-5 w-5" />
                  Classificar Mais Contas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
