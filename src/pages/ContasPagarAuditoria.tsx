import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, AlertTriangle, CheckCircle, XCircle, Brain, RefreshCw, 
  ArrowLeft, Download, FileText, TrendingUp, DollarSign, Clock,
  AlertOctagon, ShieldAlert, FileWarning, Banknote, Building2,
  ChevronRight, Eye, Loader2, MessageCircle
} from "lucide-react";
import { ContasPagarAIChat } from "@/components/financeiro/ContasPagarAIChat";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from 'react-markdown';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface Inconsistencia {
  id: string;
  tipo: string;
  severidade: 'critica' | 'alta' | 'media' | 'baixa';
  categoria: 'seguranca' | 'financeiro' | 'operacional' | 'conformidade';
  titulo: string;
  descricao: string;
  fornecedor: string;
  documento: string;
  dados: Record<string, any>;
  recomendacao: string;
}

interface Estatisticas {
  total_analisados: number;
  total_inconsistencias: number;
  valor_total_analisado: number;
  valor_em_risco: number;
  por_severidade: {
    critica: number;
    alta: number;
    media: number;
    baixa: number;
  };
  por_categoria: {
    seguranca: number;
    financeiro: number;
    operacional: number;
    conformidade: number;
  };
  por_tipo: Record<string, number>;
}

interface AuditoriaResult {
  success: boolean;
  inconsistencias: Inconsistencia[];
  estatisticas: Estatisticas;
  analise_ia?: string;
  data_analise: string;
}

const COLORS_SEVERIDADE = {
  critica: '#dc2626',
  alta: '#f97316',
  media: '#eab308',
  baixa: '#22c55e'
};

const COLORS_CATEGORIA = {
  seguranca: '#dc2626',
  financeiro: '#3b82f6',
  operacional: '#8b5cf6',
  conformidade: '#06b6d4'
};

const ICON_CATEGORIA = {
  seguranca: ShieldAlert,
  financeiro: Banknote,
  operacional: FileWarning,
  conformidade: Building2
};

export default function ContasPagarAuditoria() {
  const [anoFiltro, setAnoFiltro] = useState<string>(new Date().getFullYear().toString());
  const [tabAtiva, setTabAtiva] = useState<string>("chat");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("all");

  // Query para análise com IA
  const { data: auditoria, isLoading, refetch, isFetching } = useQuery<AuditoriaResult>({
    queryKey: ['auditoria-contas-pagar', anoFiltro],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('auditoria-contas-pagar', {
        body: { 
          action: 'ai_analysis',
          filters: { ano: anoFiltro }
        }
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const handleExportarRelatorio = () => {
    if (!auditoria?.analise_ia) {
      toast.error("Execute a análise primeiro");
      return;
    }

    const conteudo = `
RELATÓRIO DE AUDITORIA - CONTAS A PAGAR
Data: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
Período: ${anoFiltro}

========================================
ESTATÍSTICAS
========================================
Total de contas analisadas: ${auditoria.estatisticas.total_analisados}
Total de inconsistências: ${auditoria.estatisticas.total_inconsistencias}
Valor total analisado: R$ ${auditoria.estatisticas.valor_total_analisado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Valor em risco: R$ ${auditoria.estatisticas.valor_em_risco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

========================================
ANÁLISE DETALHADA
========================================
${auditoria.analise_ia}

========================================
LISTA DE INCONSISTÊNCIAS
========================================
${auditoria.inconsistencias.map((i, idx) => `
${idx + 1}. [${i.severidade.toUpperCase()}] ${i.titulo}
   Fornecedor: ${i.fornecedor}
   Documento: ${i.documento}
   Descrição: ${i.descricao}
   Recomendação: ${i.recomendacao}
`).join('\n')}
`;

    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-contas-pagar-${anoFiltro}-${format(new Date(), 'yyyyMMdd-HHmm')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  // Filtrar inconsistências por categoria
  const inconsistenciasFiltradas = auditoria?.inconsistencias.filter(i => 
    categoriaFiltro === 'all' || i.categoria === categoriaFiltro
  ) || [];

  // Dados para gráficos
  const dadosSeveridade = auditoria ? [
    { name: 'Crítica', value: auditoria.estatisticas.por_severidade.critica, color: COLORS_SEVERIDADE.critica },
    { name: 'Alta', value: auditoria.estatisticas.por_severidade.alta, color: COLORS_SEVERIDADE.alta },
    { name: 'Média', value: auditoria.estatisticas.por_severidade.media, color: COLORS_SEVERIDADE.media },
    { name: 'Baixa', value: auditoria.estatisticas.por_severidade.baixa, color: COLORS_SEVERIDADE.baixa },
  ].filter(d => d.value > 0) : [];

  const dadosCategoria = auditoria ? [
    { name: 'Segurança', value: auditoria.estatisticas.por_categoria.seguranca, color: COLORS_CATEGORIA.seguranca },
    { name: 'Financeiro', value: auditoria.estatisticas.por_categoria.financeiro, color: COLORS_CATEGORIA.financeiro },
    { name: 'Operacional', value: auditoria.estatisticas.por_categoria.operacional, color: COLORS_CATEGORIA.operacional },
    { name: 'Conformidade', value: auditoria.estatisticas.por_categoria.conformidade, color: COLORS_CATEGORIA.conformidade },
  ].filter(d => d.value > 0) : [];

  // Função para renderizar markdown com suporte a gráficos
  const renderizarAnaliseIA = (texto: string) => {
    // Extrair e renderizar gráficos
    const partes = texto.split(/```chart\n([\s\S]*?)```/g);
    
    return partes.map((parte, idx) => {
      if (idx % 2 === 1) {
        // É um bloco de gráfico
        try {
          const config = JSON.parse(parte);
          if (config.type === 'pie') {
            return (
              <div key={idx} className="my-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-center">{config.title}</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={config.data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {config.data.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={['#dc2626', '#f97316', '#eab308', '#22c55e'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          } else if (config.type === 'bar') {
            return (
              <div key={idx} className="my-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium mb-4 text-center">{config.title}</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={config.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          }
        } catch (e) {
          // Se não conseguir parsear, retorna texto normal
        }
      }
      
      return (
        <div key={idx} className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-foreground">{children}</h1>,
              h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3 text-foreground flex items-center gap-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-lg font-medium mt-4 mb-2 text-foreground">{children}</h3>,
              p: ({ children }) => <p className="text-muted-foreground mb-3 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-muted-foreground">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-muted-foreground">{children}</ol>,
              li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
              strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full border border-border rounded-lg overflow-hidden">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => <th className="bg-muted px-4 py-2 text-left text-sm font-semibold border-b">{children}</th>,
              td: ({ children }) => <td className="px-4 py-2 text-sm border-b border-border">{children}</td>,
            }}
          >
            {parte}
          </ReactMarkdown>
        </div>
      );
    });
  };

  const getBadgeSeveridade = (severidade: string) => {
    const config = {
      critica: { variant: 'destructive' as const, icon: XCircle },
      alta: { variant: 'default' as const, icon: AlertTriangle, className: 'bg-orange-500 hover:bg-orange-600' },
      media: { variant: 'default' as const, icon: AlertTriangle, className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
      baixa: { variant: 'secondary' as const, icon: CheckCircle }
    };
    const c = config[severidade as keyof typeof config] || config.baixa;
    const Icon = c.icon;
    return (
      <Badge variant={c.variant} className={`gap-1 ${'className' in c ? c.className : ''}`}>
        <Icon className="h-3 w-3" />
        {severidade.charAt(0).toUpperCase() + severidade.slice(1)}
      </Badge>
    );
  };

  // Anos disponíveis para filtro
  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  // Calcular score de risco
  const scoreRisco = auditoria ? Math.min(10, Math.round(
    (auditoria.estatisticas.por_severidade.critica * 4 +
    auditoria.estatisticas.por_severidade.alta * 2 +
    auditoria.estatisticas.por_severidade.media * 1) / 
    Math.max(1, auditoria.estatisticas.total_analisados) * 100
  )) : 0;

  const getScoreColor = (score: number) => {
    if (score <= 3) return 'text-green-500';
    if (score <= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/financeiro/contas-a-pagar">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Auditoria de Contas a Pagar
              </h1>
              <p className="text-muted-foreground text-sm">
                Análise inteligente de inconsistências e riscos financeiros
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={anoFiltro} onValueChange={setAnoFiltro}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map(ano => (
                  <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={() => refetch()} 
              disabled={isFetching}
              className="gap-2"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              {isFetching ? 'Analisando...' : 'Executar Análise'}
            </Button>

            {auditoria && (
              <Button variant="outline" onClick={handleExportarRelatorio} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium">Analisando Contas a Pagar...</h3>
              <p className="text-muted-foreground text-sm mt-1">
                A IA está verificando inconsistências e riscos de segurança
              </p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {auditoria && !isLoading && (
          <>
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas Analisadas</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {auditoria.estatisticas.total_analisados.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    R$ {auditoria.estatisticas.valor_total_analisado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Inconsistências</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-500">
                    {auditoria.estatisticas.total_inconsistencias}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {((auditoria.estatisticas.total_inconsistencias / auditoria.estatisticas.total_analisados) * 100).toFixed(1)}% das contas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
                  <AlertOctagon className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {auditoria.estatisticas.por_severidade.critica}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    + {auditoria.estatisticas.por_severidade.alta} alta prioridade
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor em Risco</CardTitle>
                  <DollarSign className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    R$ {auditoria.estatisticas.valor_em_risco.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Em itens críticos/altos
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Score de Risco</CardTitle>
                  <TrendingUp className={`h-4 w-4 ${getScoreColor(scoreRisco)}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getScoreColor(scoreRisco)}`}>
                    {scoreRisco}/10
                  </div>
                  <Progress 
                    value={scoreRisco * 10} 
                    className="h-2 mt-2"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="space-y-4">
              <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
                <TabsTrigger value="chat" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat IA
                </TabsTrigger>
                <TabsTrigger value="resumo" className="gap-2">
                  <Brain className="h-4 w-4" />
                  Análise IA
                </TabsTrigger>
                <TabsTrigger value="inconsistencias" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Inconsistências
                </TabsTrigger>
                <TabsTrigger value="graficos" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Gráficos
                </TabsTrigger>
                <TabsTrigger value="categorias" className="gap-2">
                  <Shield className="h-4 w-4" />
                  Por Categoria
                </TabsTrigger>
              </TabsList>

              {/* Tab: Chat com IA */}
              <TabsContent value="chat">
                <div className="grid gap-6 lg:grid-cols-2">
                  <ContasPagarAIChat />
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-5 w-5 text-primary" />
                        Sobre a Sofia
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        A Sofia é uma assistente de IA especializada em contas a pagar. Ela pode:
                      </p>
                      <ul className="text-sm space-y-2">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          Informar sobre contas vencidas e a vencer
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          Analisar a situação financeira atual
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          Identificar fornecedores críticos
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          Responder com voz natural
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          Aceitar comandos de voz
                        </li>
                      </ul>
                      <Separator />
                      <p className="text-xs text-muted-foreground">
                        💡 Dica: Clique no microfone para falar com a Sofia ou digite sua pergunta.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Análise IA */}
              <TabsContent value="resumo">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Relatório de Auditoria Inteligente
                    </CardTitle>
                    <CardDescription>
                      Análise gerada por IA em {auditoria.data_analise ? format(new Date(auditoria.data_analise), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'data não disponível'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      {auditoria.analise_ia ? (
                        <div className="space-y-4">
                          {renderizarAnaliseIA(auditoria.analise_ia)}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Análise não disponível</p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Lista de Inconsistências */}
              <TabsContent value="inconsistencias">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Lista de Inconsistências</CardTitle>
                        <CardDescription>
                          {inconsistenciasFiltradas.length} itens encontrados
                        </CardDescription>
                      </div>
                      <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Categorias</SelectItem>
                          <SelectItem value="seguranca">🛡️ Segurança</SelectItem>
                          <SelectItem value="financeiro">💰 Financeiro</SelectItem>
                          <SelectItem value="operacional">⚙️ Operacional</SelectItem>
                          <SelectItem value="conformidade">📋 Conformidade</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[100px]">Severidade</TableHead>
                            <TableHead className="w-[120px]">Categoria</TableHead>
                            <TableHead>Problema</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead className="w-[200px]">Recomendação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inconsistenciasFiltradas
                            .sort((a, b) => {
                              const ordem = { critica: 0, alta: 1, media: 2, baixa: 3 };
                              return ordem[a.severidade] - ordem[b.severidade];
                            })
                            .map((item) => {
                              const IconCategoria = ICON_CATEGORIA[item.categoria];
                              return (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    {getBadgeSeveridade(item.severidade)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="gap-1">
                                      <IconCategoria className="h-3 w-3" />
                                      {item.categoria}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium">{item.titulo}</p>
                                      <p className="text-xs text-muted-foreground">{item.descricao}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {item.fornecedor}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">
                                    {item.documento}
                                  </TableCell>
                                  <TableCell>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {item.recomendacao}
                                    </p>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab: Gráficos */}
              <TabsContent value="graficos">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Distribuição por Severidade</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={dadosSeveridade}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {dadosSeveridade.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Distribuição por Categoria</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dadosCategoria}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {dadosCategoria.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="text-lg">Tipos de Inconsistências</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart 
                          data={Object.entries(auditoria.estatisticas.por_tipo).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={12} />
                          <YAxis dataKey="name" type="category" width={180} fontSize={11} />
                          <Tooltip />
                          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab: Por Categoria */}
              <TabsContent value="categorias">
                <div className="grid gap-4 md:grid-cols-2">
                  {(['seguranca', 'financeiro', 'operacional', 'conformidade'] as const).map(cat => {
                    const Icon = ICON_CATEGORIA[cat];
                    const itens = auditoria.inconsistencias.filter(i => i.categoria === cat);
                    const criticos = itens.filter(i => i.severidade === 'critica').length;
                    
                    return (
                      <Card key={cat}>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Icon className="h-5 w-5" style={{ color: COLORS_CATEGORIA[cat] }} />
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            <Badge variant="outline" className="ml-auto">
                              {itens.length}
                            </Badge>
                          </CardTitle>
                          {criticos > 0 && (
                            <CardDescription className="text-red-500">
                              ⚠️ {criticos} alerta(s) crítico(s)
                            </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-[200px]">
                            <div className="space-y-2">
                              {itens.slice(0, 5).map(item => (
                                <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50">
                                  {getBadgeSeveridade(item.severidade)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.titulo}</p>
                                    <p className="text-xs text-muted-foreground truncate">{item.fornecedor}</p>
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              ))}
                              {itens.length > 5 && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full"
                                  onClick={() => {
                                    setCategoriaFiltro(cat);
                                    setTabAtiva('inconsistencias');
                                  }}
                                >
                                  Ver todos ({itens.length - 5} mais)
                                </Button>
                              )}
                              {itens.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  ✅ Nenhuma inconsistência nesta categoria
                                </p>
                              )}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty State */}
        {!auditoria && !isLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Análise de Auditoria</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Execute a análise para que a IA identifique inconsistências, riscos de segurança e oportunidades de melhoria nas suas contas a pagar.
              </p>
              <Button onClick={() => refetch()} className="gap-2">
                <Brain className="h-4 w-4" />
                Iniciar Análise com IA
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
