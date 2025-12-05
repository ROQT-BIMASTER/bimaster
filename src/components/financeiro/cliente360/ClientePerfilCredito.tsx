import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Minus, User, CreditCard, 
  Calendar, DollarSign, Clock, AlertTriangle, CheckCircle2,
  XCircle, Target, Activity, BarChart3, History, Shield
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import ScoreGauge from "./ScoreGauge";
import ClienteHistoricoPagamentos from "./ClienteHistoricoPagamentos";
import ClienteAlertasCredito from "./ClienteAlertasCredito";
import ClienteScoreHistorico from "./ClienteScoreHistorico";

interface ClientePerfilCreditoProps {
  clienteCodigo: string;
  onClose?: () => void;
}

export default function ClientePerfilCredito({ clienteCodigo, onClose }: ClientePerfilCreditoProps) {
  const [activeTab, setActiveTab] = useState("resumo");

  const { data: perfil, isLoading, refetch } = useQuery({
    queryKey: ['cliente-perfil-credito', clienteCodigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes_perfil_credito')
        .select('*')
        .eq('cliente_codigo', clienteCodigo)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!clienteCodigo
  });

  // Buscar dados brutos se não existir perfil
  const { data: dadosBrutos } = useQuery({
    queryKey: ['cliente-dados-brutos', clienteCodigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*')
        .eq('cliente_codigo', clienteCodigo);
      
      if (error) throw error;
      
      // Calcular métricas
      const total = data?.length || 0;
      const recebidos = data?.filter(t => t.status === 'recebido') || [];
      const vencidos = data?.filter(t => t.status === 'vencido') || [];
      const emDia = recebidos.filter(t => (t.dias_atraso || 0) <= 0);
      const emAtraso = recebidos.filter(t => (t.dias_atraso || 0) > 0);
      const valorTotal = data?.reduce((acc, t) => acc + (t.valor_original || 0), 0) || 0;
      const valorAberto = data?.reduce((acc, t) => acc + (t.valor_aberto || 0), 0) || 0;
      const maiorAtraso = Math.max(...(data?.map(t => t.dias_atraso || 0) || [0]));
      const dme = emAtraso.length > 0 
        ? Math.round(emAtraso.reduce((acc, t) => acc + (t.dias_atraso || 0), 0) / emAtraso.length)
        : 0;
      const pontualidade = total > 0 ? Math.round((emDia.length / total) * 100) : 100;
      
      return {
        cliente_nome: data?.[0]?.cliente_nome || 'Cliente',
        total_titulos: total,
        titulos_pagos_em_dia: emDia.length,
        titulos_pagos_em_atraso: emAtraso.length,
        titulos_vencidos: vencidos.length,
        valor_total: valorTotal,
        valor_em_aberto: valorAberto,
        maior_atraso: maiorAtraso,
        dme,
        pontualidade,
        primeira_compra: data?.sort((a, b) => new Date(a.data_emissao || '').getTime() - new Date(b.data_emissao || '').getTime())[0]?.data_emissao,
        ultima_compra: data?.sort((a, b) => new Date(b.data_emissao || '').getTime() - new Date(a.data_emissao || '').getTime())[0]?.data_emissao,
        titulos: data
      };
    },
    enabled: !!clienteCodigo && !perfil
  });

  const dados = perfil || {
    cliente_nome: dadosBrutos?.cliente_nome,
    score_atual: calcularScoreSimples(dadosBrutos),
    score_classificacao: getClassificacao(calcularScoreSimples(dadosBrutos)),
    pontualidade_percentual: dadosBrutos?.pontualidade,
    dme: dadosBrutos?.dme,
    total_titulos_historico: dadosBrutos?.total_titulos,
    titulos_pagos_em_dia: dadosBrutos?.titulos_pagos_em_dia,
    titulos_pagos_em_atraso: dadosBrutos?.titulos_pagos_em_atraso,
    maior_atraso_dias: dadosBrutos?.maior_atraso,
    total_compras_historico: dadosBrutos?.valor_total,
    limite_credito: 0,
    limite_utilizado: dadosBrutos?.valor_em_aberto,
    limite_disponivel: 0,
    primeira_compra: dadosBrutos?.primeira_compra,
    ultima_compra: dadosBrutos?.ultima_compra,
    comportamento_pagamento: getComportamento(dadosBrutos?.pontualidade),
    tendencia_score: 'novo',
    status: 'ativo'
  };

  function calcularScoreSimples(dados: any) {
    if (!dados) return 500;
    let score = 500;
    score += ((dados.pontualidade || 50) - 50) * 4;
    if (dados.maior_atraso <= 7) score += 50;
    else if (dados.maior_atraso <= 30) score += 0;
    else if (dados.maior_atraso <= 60) score -= 50;
    else score -= 100;
    return Math.max(0, Math.min(1000, score));
  }

  function getClassificacao(score: number) {
    if (score >= 800) return 'excelente';
    if (score >= 650) return 'bom';
    if (score >= 500) return 'regular';
    if (score >= 350) return 'ruim';
    return 'critico';
  }

  function getComportamento(pontualidade?: number) {
    if (!pontualidade) return 'regular';
    if (pontualidade >= 90) return 'pagador_pontual';
    if (pontualidade >= 70) return 'bom_pagador';
    if (pontualidade >= 50) return 'regular';
    if (pontualidade >= 30) return 'pagador_atrasado';
    return 'mau_pagador';
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const getClassificacaoStyle = (classificacao: string) => {
    switch (classificacao) {
      case 'excelente': return { bg: 'bg-emerald-500/20', text: 'text-emerald-500', label: 'Excelente' };
      case 'bom': return { bg: 'bg-green-500/20', text: 'text-green-500', label: 'Bom' };
      case 'regular': return { bg: 'bg-yellow-500/20', text: 'text-yellow-500', label: 'Regular' };
      case 'ruim': return { bg: 'bg-orange-500/20', text: 'text-orange-500', label: 'Ruim' };
      case 'critico': return { bg: 'bg-red-500/20', text: 'text-red-500', label: 'Crítico' };
      default: return { bg: 'bg-muted', text: 'text-muted-foreground', label: classificacao };
    }
  };

  const getComportamentoLabel = (comportamento: string) => {
    const labels: Record<string, string> = {
      'pagador_pontual': 'Pagador Pontual',
      'bom_pagador': 'Bom Pagador',
      'regular': 'Regular',
      'pagador_atrasado': 'Pagador Atrasado',
      'mau_pagador': 'Mau Pagador'
    };
    return labels[comportamento] || comportamento;
  };

  const getTendenciaIcon = (tendencia: string) => {
    switch (tendencia) {
      case 'melhorando': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'piorando': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const classificacaoStyle = getClassificacaoStyle(dados.score_classificacao || 'regular');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header do Cliente */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{dados.cliente_nome || 'Cliente'}</h2>
            <p className="text-sm text-muted-foreground">Código: {clienteCodigo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={dados.status === 'ativo' ? 'default' : 'destructive'}>
            {dados.status === 'ativo' ? 'Ativo' : dados.status}
          </Badge>
          {dados.status === 'bloqueado' && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Bloqueado
            </Badge>
          )}
        </div>
      </div>

      {/* Score e Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score Card */}
        <Card className="col-span-1">
          <CardContent className="pt-6 flex flex-col items-center">
            <ScoreGauge score={dados.score_atual || 500} />
            <div className="mt-4 text-center">
              <Badge className={`${classificacaoStyle.bg} ${classificacaoStyle.text} border-0`}>
                {classificacaoStyle.label}
              </Badge>
              <div className="flex items-center justify-center gap-1 mt-2 text-sm text-muted-foreground">
                {getTendenciaIcon(dados.tendencia_score || 'estavel')}
                <span>
                  {dados.tendencia_score === 'melhorando' ? 'Melhorando' :
                   dados.tendencia_score === 'piorando' ? 'Piorando' : 'Estável'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas Principais */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Métricas de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pontualidade</p>
                <div className="flex items-center gap-2">
                  <Progress value={dados.pontualidade_percentual || 0} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{(dados.pontualidade_percentual || 0).toFixed(0)}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">DME (Dias Médios)</p>
                <p className="text-lg font-semibold">{dados.dme || 0} dias</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total de Títulos</p>
                <p className="text-lg font-semibold">{dados.total_titulos_historico || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Maior Atraso</p>
                <p className="text-lg font-semibold text-orange-500">{dados.maior_atraso_dias || 0} dias</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Pagos em Dia
                </p>
                <p className="text-lg font-semibold text-emerald-500">{dados.titulos_pagos_em_dia || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Pagos em Atraso
                </p>
                <p className="text-lg font-semibold text-red-500">{dados.titulos_pagos_em_atraso || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Informação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Total Compras</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(dados.total_compras_historico || 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs">Limite Disponível</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(dados.limite_disponivel || 0)}</p>
            <p className="text-xs text-muted-foreground">
              de {formatCurrency(dados.limite_credito || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Primeira Compra</span>
            </div>
            <p className="text-sm font-medium">
              {dados.primeira_compra 
                ? format(parseISO(dados.primeira_compra), 'dd/MM/yyyy', { locale: ptBR })
                : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Última Compra</span>
            </div>
            <p className="text-sm font-medium">
              {dados.ultima_compra 
                ? format(parseISO(dados.ultima_compra), 'dd/MM/yyyy', { locale: ptBR })
                : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Comportamento */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="font-medium">Comportamento de Pagamento</span>
            </div>
            <Badge variant="outline">
              {getComportamentoLabel(dados.comportamento_pagamento || 'regular')}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabs de Detalhes */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="resumo" className="gap-1 text-xs">
            <BarChart3 className="h-3 w-3" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1 text-xs">
            <History className="h-3 w-3" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="score" className="gap-1 text-xs">
            <Target className="h-3 w-3" />
            Score
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Análise de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Limite de Crédito</span>
                  <span className="font-medium">{formatCurrency(dados.limite_credito || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Utilizado</span>
                  <span className="font-medium text-orange-500">{formatCurrency(dados.limite_utilizado || 0)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Disponível</span>
                  <span className="font-medium text-emerald-500">{formatCurrency(dados.limite_disponivel || 0)}</span>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Utilização do Limite</p>
                  <Progress 
                    value={dados.limite_credito ? ((dados.limite_utilizado || 0) / dados.limite_credito) * 100 : 0} 
                    className="h-3"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <ClienteHistoricoPagamentos clienteCodigo={clienteCodigo} />
        </TabsContent>

        <TabsContent value="score" className="mt-4">
          <ClienteScoreHistorico clienteCodigo={clienteCodigo} />
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <ClienteAlertasCredito clienteCodigo={clienteCodigo} onRefresh={refetch} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
