import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  FileText,
  Calendar,
  RefreshCw,
  Sparkles,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

const COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];

export default function VisaoDepartamentos() {
  const [periodoInicio, setPeriodoInicio] = useState(format(startOfMonth(subMonths(new Date(), 3)), 'yyyy-MM-dd'));
  const [periodoFim, setPeriodoFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Buscar análises por departamento
  const { data: analises, isLoading, refetch } = useQuery({
    queryKey: ['analises-departamentos', periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_analise_departamentos', {
        p_periodo_inicio: periodoInicio,
        p_periodo_fim: periodoFim
      });

      if (error) throw error;
      return data;
    }
  });

  // Buscar totais gerais
  const { data: totais } = useQuery({
    queryKey: ['totais-transacoes', periodoInicio, periodoFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('tipo, valor, classificado_automaticamente')
        .gte('data_transacao', periodoInicio)
        .lte('data_transacao', periodoFim);

      if (error) throw error;

      const totalReceitas = data?.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + parseFloat(t.valor as any), 0) || 0;
      const totalDespesas = data?.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + parseFloat(t.valor as any), 0) || 0;
      const totalTransacoes = data?.length || 0;
      const classificacoesAutomaticas = data?.filter(t => t.classificado_automaticamente).length || 0;

      return {
        totalReceitas,
        totalDespesas,
        saldo: totalReceitas - totalDespesas,
        totalTransacoes,
        classificacoesAutomaticas,
        percentualAutomatico: totalTransacoes > 0 ? (classificacoesAutomaticas / totalTransacoes * 100) : 0
      };
    }
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await supabase.rpc('refresh_analise_departamentos');
      await refetch();
      toast.success("Análises atualizadas com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar análises");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Preparar dados para gráficos
  const dadosPorDepartamento = analises?.reduce((acc: any[], analise: any) => {
    const existing = acc.find(d => d.departamento === analise.departamento_nome);
    if (existing) {
      if (analise.tipo === 'receita') {
        existing.receitas += parseFloat(analise.valor_total);
      } else {
        existing.despesas += parseFloat(analise.valor_total);
      }
      existing.total += parseFloat(analise.valor_total);
    } else {
      acc.push({
        departamento: analise.departamento_nome,
        receitas: analise.tipo === 'receita' ? parseFloat(analise.valor_total) : 0,
        despesas: analise.tipo === 'despesa' ? parseFloat(analise.valor_total) : 0,
        total: parseFloat(analise.valor_total)
      });
    }
    return acc;
  }, []) || [];

  const dadosEvolucao = analises?.reduce((acc: any[], analise: any) => {
    const mes = format(new Date(analise.periodo_mes), 'MMM/yy', { locale: ptBR });
    const existing = acc.find(d => d.mes === mes);
    
    if (existing) {
      if (analise.tipo === 'receita') {
        existing.receitas += parseFloat(analise.valor_total);
      } else {
        existing.despesas += parseFloat(analise.valor_total);
      }
    } else {
      acc.push({
        mes,
        receitas: analise.tipo === 'receita' ? parseFloat(analise.valor_total) : 0,
        despesas: analise.tipo === 'despesa' ? parseFloat(analise.valor_total) : 0
      });
    }
    return acc;
  }, []).sort((a: any, b: any) => {
    const [mesA, anoA] = a.mes.split('/');
    const [mesB, anoB] = b.mes.split('/');
    return new Date(`20${anoA}-${mesA}`).getTime() - new Date(`20${anoB}-${mesB}`).getTime();
  }) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Visão por Departamento</h1>
            <p className="text-muted-foreground mt-1">
              Análise financeira classificada automaticamente com IA
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Receitas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totais ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.totalReceitas) : '-'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Despesas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totais ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.totalDespesas) : '-'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                Saldo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totais && totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totais ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totais.saldo) : '-'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Classificação IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {totais ? `${Math.round(totais.percentualAutomatico)}%` : '-'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totais?.classificacoesAutomaticas} de {totais?.totalTransacoes} transações
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="visao-geral" className="space-y-4">
          <TabsList>
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução Temporal</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes por Departamento</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Despesas por Departamento</CardTitle>
                  <CardDescription>Distribuição total do período</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dadosPorDepartamento}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.departamento} (${Math.round(entry.despesas / dadosPorDepartamento.reduce((sum: number, d: any) => sum + d.despesas, 0) * 100)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="despesas"
                      >
                        {dadosPorDepartamento.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Comparativo Receitas x Despesas</CardTitle>
                  <CardDescription>Por departamento</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dadosPorDepartamento}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="departamento" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                      />
                      <Legend />
                      <Bar dataKey="receitas" fill="#10B981" name="Receitas" />
                      <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evolucao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Mensal</CardTitle>
                <CardDescription>Receitas e despesas ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={dadosEvolucao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} name="Receitas" />
                    <Line type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} name="Despesas" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detalhes" className="space-y-4">
            <div className="grid gap-4">
              {dadosPorDepartamento.map((dept: any, index: number) => (
                <Card key={dept.departamento}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        {dept.departamento}
                      </CardTitle>
                      <Badge variant="secondary">
                        {analises?.filter((a: any) => a.departamento_nome === dept.departamento).reduce((sum: number, a: any) => sum + parseInt(a.total_transacoes), 0)} transações
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Receitas</p>
                        <p className="text-lg font-bold text-green-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dept.receitas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Despesas</p>
                        <p className="text-lg font-bold text-red-600">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dept.despesas)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Saldo</p>
                        <p className={`text-lg font-bold ${dept.receitas - dept.despesas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dept.receitas - dept.despesas)}
                        </p>
                      </div>
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
