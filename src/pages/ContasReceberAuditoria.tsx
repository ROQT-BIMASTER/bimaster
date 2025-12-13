import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  Brain, 
  FileWarning,
  TrendingDown,
  Calendar,
  DollarSign,
  Copy,
  RefreshCw,
  Download,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface Inconsistencia {
  id: string;
  tipo: string;
  severidade: 'alta' | 'media' | 'baixa';
  titulo: string;
  descricao: string;
  cliente: string;
  documento: string;
  dados: Record<string, any>;
}

interface Estatisticas {
  total_analisados: number;
  total_inconsistencias: number;
  por_severidade: {
    alta: number;
    media: number;
    baixa: number;
  };
  por_tipo: Record<string, number>;
}

const TIPO_LABELS: Record<string, string> = {
  valor_divergente: "Valor Divergente",
  data_pagamento_invalida: "Data Pagamento Inválida",
  prazo_longo: "Prazo Longo",
  vencimento_antes_emissao: "Vencimento Antes Emissão",
  valor_negativo: "Valor Negativo",
  atraso_critico: "Atraso Crítico",
  dados_incompletos: "Dados Incompletos",
  status_inconsistente: "Status Inconsistente",
  valor_suspeito: "Valor Suspeito",
  duplicidade: "Duplicidade"
};

const TIPO_ICONS: Record<string, React.ReactNode> = {
  valor_divergente: <DollarSign className="h-4 w-4" />,
  data_pagamento_invalida: <Calendar className="h-4 w-4" />,
  prazo_longo: <Clock className="h-4 w-4" />,
  vencimento_antes_emissao: <Calendar className="h-4 w-4" />,
  valor_negativo: <TrendingDown className="h-4 w-4" />,
  atraso_critico: <AlertTriangle className="h-4 w-4" />,
  dados_incompletos: <FileWarning className="h-4 w-4" />,
  status_inconsistente: <AlertTriangle className="h-4 w-4" />,
  valor_suspeito: <DollarSign className="h-4 w-4" />,
  duplicidade: <Copy className="h-4 w-4" />
};

export default function ContasReceberAuditoria() {
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas | null>(null);
  const [analiseIA, setAnaliseIA] = useState<string | null>(null);
  const [filtroSeveridade, setFiltroSeveridade] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);

  const executarAuditoria = async (comIA = false) => {
    if (comIA) {
      setAnalyzing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('auditoria-contas-receber', {
        body: { 
          action: comIA ? 'ai_analysis' : 'analyze',
          limit: 5000
        }
      });

      if (error) throw error;

      if (data.success) {
        setInconsistencias(data.inconsistencias);
        setEstatisticas(data.estatisticas);
        if (data.analise_ia) {
          setAnaliseIA(data.analise_ia);
        }
        toast.success(`Auditoria concluída: ${data.estatisticas.total_inconsistencias} inconsistências encontradas`);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error("Erro na auditoria:", error);
      toast.error("Erro ao executar auditoria: " + error.message);
    } finally {
      setLoading(false);
      setAnalyzing(false);
    }
  };

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case 'alta': return 'destructive';
      case 'media': return 'secondary';
      case 'baixa': return 'outline';
      default: return 'outline';
    }
  };

  const filteredInconsistencias = inconsistencias.filter(i => {
    if (filtroSeveridade && i.severidade !== filtroSeveridade) return false;
    if (filtroTipo && i.tipo !== filtroTipo) return false;
    return true;
  });

  const exportarCSV = () => {
    const headers = ['Tipo', 'Severidade', 'Cliente', 'Documento', 'Descrição'];
    const rows = filteredInconsistencias.map(i => [
      TIPO_LABELS[i.tipo] || i.tipo,
      i.severidade,
      i.cliente,
      i.documento,
      i.descricao
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `auditoria_cr_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Auditoria de Contas a Receber</h1>
            <p className="text-muted-foreground">
              Análise automatizada de inconsistências com suporte de IA
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => executarAuditoria(false)}
              disabled={loading || analyzing}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Análise Rápida
                </>
              )}
            </Button>
            <Button 
              onClick={() => executarAuditoria(true)}
              disabled={loading || analyzing}
            >
              {analyzing ? (
                <>
                  <Brain className="mr-2 h-4 w-4 animate-pulse" />
                  IA Analisando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Análise com IA
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        {estatisticas && (
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Registros Analisados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {estatisticas.total_analisados.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Inconsistências
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {estatisticas.total_inconsistencias}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
                  Severidade Alta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {estatisticas.por_severidade.alta}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Severidade Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {estatisticas.por_severidade.media}
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">
                  Severidade Baixa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {estatisticas.por_severidade.baixa}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conteúdo Principal */}
        <Tabs defaultValue="inconsistencias" className="w-full">
          <TabsList>
            <TabsTrigger value="inconsistencias">
              <AlertTriangle className="mr-2 h-4 w-4" />
              Inconsistências ({filteredInconsistencias.length})
            </TabsTrigger>
            <TabsTrigger value="analise-ia" disabled={!analiseIA}>
              <Brain className="mr-2 h-4 w-4" />
              Análise IA
            </TabsTrigger>
            <TabsTrigger value="tipos">
              <FileWarning className="mr-2 h-4 w-4" />
              Por Tipo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inconsistencias" className="space-y-4 mt-4">
            {/* Filtros */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium mr-2">Filtrar:</span>
                  
                  <Button
                    variant={filtroSeveridade === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltroSeveridade(null)}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={filtroSeveridade === 'alta' ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => setFiltroSeveridade(filtroSeveridade === 'alta' ? null : 'alta')}
                  >
                    Alta
                  </Button>
                  <Button
                    variant={filtroSeveridade === 'media' ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setFiltroSeveridade(filtroSeveridade === 'media' ? null : 'media')}
                  >
                    Média
                  </Button>
                  <Button
                    variant={filtroSeveridade === 'baixa' ? "outline" : "ghost"}
                    size="sm"
                    onClick={() => setFiltroSeveridade(filtroSeveridade === 'baixa' ? null : 'baixa')}
                  >
                    Baixa
                  </Button>

                  <Separator orientation="vertical" className="h-8 mx-2" />

                  {filtroTipo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltroTipo(null)}
                    >
                      Limpar tipo ✕
                    </Button>
                  )}

                  <div className="ml-auto">
                    <Button variant="outline" size="sm" onClick={exportarCSV} disabled={filteredInconsistencias.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Inconsistências */}
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredInconsistencias.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                      <h3 className="text-lg font-semibold">
                        {inconsistencias.length === 0 
                          ? "Execute uma auditoria para começar" 
                          : "Nenhuma inconsistência encontrada com os filtros atuais"}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {inconsistencias.length === 0 
                          ? "Clique em 'Análise Rápida' ou 'Análise com IA'" 
                          : "Tente ajustar os filtros"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredInconsistencias.map((item) => (
                    <Card key={item.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${
                              item.severidade === 'alta' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' :
                              item.severidade === 'media' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {TIPO_ICONS[item.tipo] || <AlertTriangle className="h-4 w-4" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{item.titulo}</h4>
                                <Badge variant={getSeveridadeColor(item.severidade)}>
                                  {item.severidade}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className="cursor-pointer hover:bg-muted"
                                  onClick={() => setFiltroTipo(item.tipo)}
                                >
                                  {TIPO_LABELS[item.tipo] || item.tipo}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.descricao}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <strong>Cliente:</strong> {item.cliente}
                                </span>
                                <span className="flex items-center gap-1">
                                  <strong>Doc:</strong> {item.documento}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="analise-ia" className="mt-4">
            {analiseIA ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Análise Inteligente
                  </CardTitle>
                  <CardDescription>
                    Avaliação gerada por IA baseada nas inconsistências encontradas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{analiseIA}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Análise com IA não disponível</h3>
                  <p className="text-muted-foreground text-sm">
                    Execute a "Análise com IA" para gerar insights inteligentes
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tipos" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {estatisticas && Object.entries(estatisticas.por_tipo).map(([tipo, count]) => (
                <Card 
                  key={tipo} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setFiltroTipo(tipo);
                    // Mudar para aba de inconsistências
                    const tabTrigger = document.querySelector('[data-state="inactive"][value="inconsistencias"]') as HTMLButtonElement;
                    tabTrigger?.click();
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {TIPO_ICONS[tipo] || <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div>
                          <h4 className="font-medium">{TIPO_LABELS[tipo] || tipo}</h4>
                          <p className="text-sm text-muted-foreground">
                            {count} ocorrência{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
